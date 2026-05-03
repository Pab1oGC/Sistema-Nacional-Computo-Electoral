#!/bin/bash
# ============================================================
# 00-replication-config.sh
#
# Init hook que se ejecuta ANTES de los .sql en
# /docker-entrypoint-initdb.d/. Hace dos cosas:
#   1. Aplica parámetros de replicación vía ALTER SYSTEM
#      (escribe en postgresql.auto.conf).
#   2. Apenda entradas a pg_hba.conf para permitir conexiones
#      de replicación y de dashboard_ro desde la red Docker.
#
# Por qué acá y no via `command:` flags en docker-compose:
# El override de `command:` rompe la inicialización del entrypoint
# oficial (POSTGRES_DB no se crea, init scripts no se ejecutan).
# ALTER SYSTEM en un init hook es la solución idiomática: la
# escritura persiste en postgresql.auto.conf y el server real
# (que arranca después del init) la levanta.
#
# El temp server del init no tiene wal_level=replica todavía;
# eso es OK porque durante init no se hacen replicaciones.
# Cuando el server real arranca tras el init, ya tiene los
# settings aplicados.
# ============================================================
set -e

# ─── 1. Parámetros de postgresql.conf vía ALTER SYSTEM ──────
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER SYSTEM SET wal_level                  = 'replica';
    ALTER SYSTEM SET max_wal_senders            = 10;
    ALTER SYSTEM SET max_replication_slots      = 5;
    ALTER SYSTEM SET synchronous_commit         = 'on';
    ALTER SYSTEM SET synchronous_standby_names  = 'oficial_replica';
    ALTER SYSTEM SET hot_standby                = 'on';
    ALTER SYSTEM SET listen_addresses           = '*';
    ALTER SYSTEM SET wal_keep_size              = '1GB';
EOSQL

echo "[init] Parámetros de replicación escritos en postgresql.auto.conf."

# ─── 2. Entradas en pg_hba.conf para replicación remota ─────
# El default de la imagen postgres NO permite replicación desde hosts
# remotos. Agregamos entradas explícitas para los rangos privados RFC1918
# (10.x, 172.16-31.x, 192.168.x). No acoplamos a un rango específico de
# Docker porque diferentes versiones de Docker Desktop usan distintos
# rangos.
{
    echo ""
    echo "# === Entradas para replicación síncrona del cluster Mirror ==="
    echo "# Permite que oficial_replicator se conecte para pg_basebackup y"
    echo "# streaming desde cualquier host de la red Docker interna."
    echo "host  replication  oficial_replicator  10.0.0.0/8       scram-sha-256"
    echo "host  replication  oficial_replicator  172.16.0.0/12    scram-sha-256"
    echo "host  replication  oficial_replicator  192.168.0.0/16   scram-sha-256"
    echo ""
    echo "# Permite que dashboard_ro se conecte a la réplica para SELECT."
    echo "host  oficial      dashboard_ro        10.0.0.0/8       scram-sha-256"
    echo "host  oficial      dashboard_ro        172.16.0.0/12    scram-sha-256"
    echo "host  oficial      dashboard_ro        192.168.0.0/16   scram-sha-256"
} >> "$PGDATA/pg_hba.conf"

echo "[init] Entradas de replicación apendadas a pg_hba.conf."
echo "[init] El server real las aplicará al arrancar tras el init."
