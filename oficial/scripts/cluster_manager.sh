#!/bin/sh
# ============================================================
# cluster_manager.sh — FASE 7C
#
# Detecta SPLIT BRAIN (master volvió como primary después de un
# failover en el que la réplica fue promovida) y reincorpora
# automáticamente al ex-master como standby de la nueva primary
# usando pg_basebackup.
#
# Estados manejados:
#   NORMAL         master.in_recovery=false, replica.in_recovery=true
#                  → no actuar
#   FAILED_OVER    master.alive=false, replica.in_recovery=false
#                  → no actuar (sistema ya operativo via failover)
#   POST_FAILOVER  master.in_recovery=true, replica.in_recovery=false
#                  (master ya reincorporado como standby)
#                  → no actuar
#   SPLIT_BRAIN    master.alive=true, master.in_recovery=false,
#                  replica.alive=true, replica.in_recovery=false,
#                  master.standbys=0
#                  → ACTUAR: stop master, basebackup desde replica,
#                            start master como standby
#
# Loop check_interval (default 10s).
# ============================================================

set -e

LOG() { echo "[CLUSTER_MGR] $(date -Iseconds) $*"; }

# ─── Config ────────────────────────────────────────────────────
PGUSER="${PGUSER:-oficial_writer}"
PGDATABASE="${PGDATABASE:-oficial}"
PGPASSWORD="${PGPASSWORD:-oficial_2025}"
REPLICATION_PASSWORD="${REPLICATION_PASSWORD:-replica_2025}"
API_BASE="${API_BASE:-http://oficial_api:8000}"
CHECK_INTERVAL="${CHECK_INTERVAL:-10}"
MASTER_HOST="${MASTER_HOST:-oficial_master}"
REPLICA_HOST="${REPLICA_HOST:-oficial_replica}"
MASTER_VOLUME="${MASTER_VOLUME:-oficial_oficial_master_data}"
DOCKER_NETWORK="${DOCKER_NETWORK:-rrv-net}"
NEW_MASTER_SLOT="oficial_master_slot"
PG_IMAGE="postgres:16.6-alpine"

export PGPASSWORD

# ─── Instalar docker-cli si no está (alpine) ──────────────────
if ! command -v docker >/dev/null 2>&1; then
    LOG "Instalando docker-cli..."
    apk add --no-cache docker-cli >/dev/null 2>&1 || {
        LOG "ERROR: no se pudo instalar docker-cli"
        exit 1
    }
fi

# Curl para consultar el API del backend
if ! command -v curl >/dev/null 2>&1; then
    apk add --no-cache curl >/dev/null 2>&1
fi

LOG "cluster_manager iniciado. Check interval: ${CHECK_INTERVAL}s"
LOG "Master: $MASTER_HOST | Replica: $REPLICA_HOST | API: $API_BASE"

# ─── Helpers ───────────────────────────────────────────────────
is_alive() {
    pg_isready -h "$1" -U "$PGUSER" -t 2 >/dev/null 2>&1
}

in_recovery() {
    psql -h "$1" -U "$PGUSER" -d "$PGDATABASE" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' \n'
}

count_standbys() {
    psql -h "$1" -U "$PGUSER" -d "$PGDATABASE" -tAc "SELECT COUNT(*) FROM pg_stat_replication;" 2>/dev/null | tr -d ' \n'
}

api_current_primary() {
    curl -s --max-time 3 "${API_BASE}/api/v1/oficial/admin/cluster-status" 2>/dev/null \
        | sed -n 's/.*"current_primary":"\([^"]*\)".*/\1/p'
}

# ─── Reincorporación del master viejo como standby ─────────────
reincorporate_master_as_standby() {
    LOG "==== INICIO reincorporación de $MASTER_HOST como standby de $REPLICA_HOST ===="

    LOG "1/6 Asegurar que existe slot $NEW_MASTER_SLOT en la nueva primary"
    psql -h "$REPLICA_HOST" -U "$PGUSER" -d "$PGDATABASE" -c \
        "SELECT pg_create_physical_replication_slot('$NEW_MASTER_SLOT')
           WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots
                              WHERE slot_name='$NEW_MASTER_SLOT');" \
        2>&1 | tail -2 | sed 's/^/    /'

    LOG "2/6 Detener container $MASTER_HOST"
    docker stop "$MASTER_HOST" >/dev/null 2>&1 || {
        LOG "    docker stop falló (¿master ya está down?)"
    }
    sleep 2

    LOG "3/6 Borrar contenido del volumen $MASTER_VOLUME (sin borrar el volumen)"
    docker run --rm -v "${MASTER_VOLUME}:/data" alpine \
        sh -c 'rm -rf /data/..?* /data/.[!.]* /data/* 2>&1 | head -3 || true' \
        2>&1 | sed 's/^/    /'

    LOG "4/6 pg_basebackup desde $REPLICA_HOST → volumen del master"
    docker run --rm \
        -v "${MASTER_VOLUME}:/data" \
        -e PGPASSWORD="$REPLICATION_PASSWORD" \
        --user postgres \
        --network "$DOCKER_NETWORK" \
        "$PG_IMAGE" \
        pg_basebackup -h "$REPLICA_HOST" -p 5432 -U oficial_replicator \
                      -D /data -P -X stream -R \
                      --slot="$NEW_MASTER_SLOT" \
        2>&1 | tail -3 | sed 's/^/    /'

    LOG "5/6 Agregar settings de standby al postgresql.conf"
    docker run --rm -v "${MASTER_VOLUME}:/data" alpine sh -c "
        echo '' >> /data/postgresql.conf
        echo \"primary_slot_name = '$NEW_MASTER_SLOT'\" >> /data/postgresql.conf
        echo 'hot_standby = on' >> /data/postgresql.conf
        echo 'hot_standby_feedback = on' >> /data/postgresql.conf
    " 2>&1 | sed 's/^/    /'

    LOG "6/6 Iniciar $MASTER_HOST (arranca como standby vía standby.signal)"
    docker start "$MASTER_HOST" >/dev/null 2>&1 || {
        LOG "    ERROR: docker start falló"
        return 1
    }

    LOG "Esperando que el ex-master se conecte como standby..."
    for i in 1 2 3 4 5 6 7 8 9 10; do
        sleep 3
        if is_alive "$MASTER_HOST"; then
            rec=$(in_recovery "$MASTER_HOST")
            if [ "$rec" = "t" ]; then
                LOG "==== ✓ Reincorporación COMPLETA en ~$((i*3))s ===="
                LOG "Cluster ahora: $REPLICA_HOST=primary, $MASTER_HOST=standby"
                return 0
            fi
        fi
    done

    LOG "==== ✗ Reincorporación NO completó dentro del timeout ===="
    return 1
}

# ─── Loop principal ────────────────────────────────────────────
LOG "Esperando 15s para que el cluster se estabilice antes del primer check..."
sleep 15

while true; do
    # 1. Liveness probes
    if is_alive "$MASTER_HOST"; then m_alive=true; else m_alive=false; fi
    if is_alive "$REPLICA_HOST"; then r_alive=true; else r_alive=false; fi

    if [ "$m_alive" = "false" ] && [ "$r_alive" = "false" ]; then
        LOG "estado=AMBOS_DOWN — no se puede actuar"
        sleep "$CHECK_INTERVAL"
        continue
    fi

    if [ "$m_alive" = "false" ]; then
        LOG "estado=MASTER_DOWN (replica sigue, posible failover en curso)"
        sleep "$CHECK_INTERVAL"
        continue
    fi

    if [ "$r_alive" = "false" ]; then
        LOG "estado=REPLICA_DOWN (master OK)"
        sleep "$CHECK_INTERVAL"
        continue
    fi

    # 2. Recovery status
    m_rec=$(in_recovery "$MASTER_HOST")
    r_rec=$(in_recovery "$REPLICA_HOST")

    # NORMAL: master primary (rec=f), replica standby (rec=t)
    if [ "$m_rec" = "f" ] && [ "$r_rec" = "t" ]; then
        # Sub-caso: ¿current_primary es 'replica'? Si sí, es split-brain
        # justo después de un fallback completado donde el operador puso
        # al master de vuelta como standby pero el backend cree replica.
        # Pero si master.rec=f y replica.rec=t, master es claramente primary.
        # → log y no actuar.
        : # silencio normal
    elif [ "$m_rec" = "t" ] && [ "$r_rec" = "f" ]; then
        # POST_FAILOVER: master ya reincorporado como standby de la replica
        : # silencio normal
    elif [ "$m_rec" = "f" ] && [ "$r_rec" = "f" ]; then
        # SPLIT BRAIN candidate: ambos primary
        # Heurística: ¿quién es la verdadera primary?
        #   - El que tiene un standby conectado lo es
        #   - O consultar el backend (current_primary='replica' tras failover)
        m_standbys=$(count_standbys "$MASTER_HOST")
        r_standbys=$(count_standbys "$REPLICA_HOST")
        api_pri=$(api_current_primary)

        LOG "estado=SPLIT_BRAIN_CANDIDATE | master.standbys=$m_standbys, replica.standbys=$r_standbys, api.current_primary=$api_pri"

        # Confirmar SPLIT BRAIN: master no tiene standbys Y backend dice que replica es primary
        if [ "$m_standbys" = "0" ] && [ "$api_pri" = "replica" ]; then
            LOG "SPLIT BRAIN CONFIRMADO. Reincorporando $MASTER_HOST como standby."
            if reincorporate_master_as_standby; then
                LOG "Reincorporación exitosa. Próximo check en ${CHECK_INTERVAL}s."
            else
                LOG "Reincorporación FALLÓ. Esperando próximo ciclo."
            fi
        else
            LOG "Estado ambiguo, no actuar (api_pri=$api_pri esperado=replica)."
        fi
    fi

    sleep "$CHECK_INTERVAL"
done
