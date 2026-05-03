#!/usr/bin/env bash
# ============================================================
# 03-replication-replica.sh
# Inicializa oficial_replica como standby síncrono del master.
#
# Idempotente: si standby.signal ya existe en el data dir, sale OK.
#
# Asume:
#   - Container oficial_replica corre con PGDATA en
#     /var/lib/postgresql/data por defecto.
#   - Master está vivo y aceptando conexiones del usuario
#     oficial_replicator.
#   - Variables de entorno opcionales: MASTER_HOST, REPLICATOR_USER,
#     REPLICATOR_PASS.
#
# Uso típico (mounted en el container):
#   docker exec -u postgres oficial_replica /scripts/03-replication-replica.sh
# ============================================================

set -euo pipefail

MASTER_HOST="${MASTER_HOST:-oficial_master}"
REPLICATOR_USER="${REPLICATOR_USER:-oficial_replicator}"
REPLICATOR_PASS="${REPLICATOR_PASS:-oficial_replicator_2025}"
REPLICA_DATA_DIR="${PGDATA:-/var/lib/postgresql/data}"
SLOT_NAME="oficial_replica_slot"

log() { echo "[replica] $*"; }

if [ -f "${REPLICA_DATA_DIR}/standby.signal" ]; then
    log "standby.signal ya existe. Réplica configurada. Salgo."
    exit 0
fi

if [ "$(ls -A "${REPLICA_DATA_DIR}" 2>/dev/null || true)" ]; then
    log "Data dir no está vacío y NO es standby. Limpiando..."
    rm -rf "${REPLICA_DATA_DIR:?}"/*
fi

log "Esperando que master ${MASTER_HOST} esté disponible..."
until PGPASSWORD="${REPLICATOR_PASS}" \
        psql -h "${MASTER_HOST}" -U "${REPLICATOR_USER}" -d postgres \
        -c 'SELECT 1' > /dev/null 2>&1; do
    sleep 2
done
log "Master accesible."

log "Ejecutando pg_basebackup (puede tardar segundos a minutos)..."
PGPASSWORD="${REPLICATOR_PASS}" pg_basebackup \
    --host="${MASTER_HOST}" \
    --username="${REPLICATOR_USER}" \
    --pgdata="${REPLICA_DATA_DIR}" \
    --progress \
    --write-recovery-conf \
    --wal-method=stream \
    --slot="${SLOT_NAME}" \
    --create-slot

# pg_basebackup -R deja primary_conninfo en postgresql.auto.conf.
# Sobrescribimos para incluir application_name='oficial_replica' que es
# lo que el master usa en synchronous_standby_names.
cat > "${REPLICA_DATA_DIR}/postgresql.auto.conf" <<EOF
primary_conninfo = 'host=${MASTER_HOST} user=${REPLICATOR_USER} password=${REPLICATOR_PASS} application_name=oficial_replica'
primary_slot_name = '${SLOT_NAME}'
EOF

# hot_standby + hot_standby_feedback en la réplica.
cat >> "${REPLICA_DATA_DIR}/postgresql.conf" <<'EOF'

# === Append por 03-replication-replica.sh ===
hot_standby = on
hot_standby_feedback = on
EOF

chown -R postgres:postgres "${REPLICA_DATA_DIR}"
chmod 700 "${REPLICA_DATA_DIR}"

log "Réplica inicializada. Iniciar postgres con el comando habitual."
log "Verificar luego desde el master con:"
log "    SELECT application_name, sync_state FROM pg_stat_replication;"
