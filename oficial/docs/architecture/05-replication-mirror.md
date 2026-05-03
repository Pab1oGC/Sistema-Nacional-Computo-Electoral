# 05 — Replicación Mirror PostgreSQL

## Propósito

Decisiones arquitectónicas sobre el cluster `oficial_master` + `oficial_replica`. Para configuración exhaustiva (postgresql.conf, pg_hba.conf, pg_basebackup), ver la skill `postgresql-mirror-replication` que se carga al editar archivos en `oficial/sql/`.

## Por qué Mirror y no otra técnica

| Técnica                              | RPO  | Consistencia | Encaja con resultados oficiales? |
|--------------------------------------|------|--------------|----------------------------------|
| Single node                          | 0    | Fuerte       | NO: sin tolerancia a fallos      |
| Mirror asíncrono                     | > 0  | Fuerte       | NO: pérdida potencial de datos   |
| **Mirror síncrono (elegido)**        | 0    | Fuerte       | SÍ                               |
| Multi-master (BDR)                   | 0    | Eventual     | NO: consistencia eventual no aplica |
| Sharding                             | 0    | Local fuerte | NO: 5396 mesas no justifican shards |

Resultados oficiales son legalmente vinculantes. Perder el último commit es inaceptable. Por eso `synchronous_commit=on` con `synchronous_standby_names='oficial_replica'`.

## Configuración mínima del master

Resumen para entender el alcance. La configuración completa con valores y razones vive en la skill.

- `wal_level = replica` (mínimo necesario para streaming replication).
- `max_wal_senders = 10` (suficiente para 1 réplica + slack).
- `synchronous_commit = on`.
- `synchronous_standby_names = 'oficial_replica'`.
- `hot_standby = on` (para que la réplica acepte SELECTs).
- `max_replication_slots = 5`.

## Configuración mínima de la réplica

Creada con `pg_basebackup` apuntando al master:

```bash
pg_basebackup \
  -h oficial_master -U replicator \
  -D /var/lib/postgresql/data \
  -P -R -X stream \
  --slot=oficial_replica_slot --create-slot
```

`-R` genera automáticamente:

- `standby.signal` (archivo vacío que indica modo standby).
- `postgresql.auto.conf` con `primary_conninfo` apuntando al master.

## Failover manual con pg_promote()

Decisión: NO implementar failover automático (no Patroni, no repmgr). El operador ejecuta manualmente:

```sql
SELECT pg_promote();
```

Verificación:

```sql
SELECT pg_is_in_recovery();
-- f = ya es primario
```

Comando `/demo-failover` (en `.claude/commands/`) automatiza la demo end-to-end: caída del master, promoción, escritura post-failover, reincorporación del ex-master como nuevo standby.

## Verificación del estado de replicación

### Desde el master:

```sql
SELECT application_name, state, sync_state,
       pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes
FROM pg_stat_replication;
```

`sync_state` debe ser `sync` (no `async`). Si aparece `async`, la replicación NO es síncrona aunque la config diga lo contrario, típicamente porque `synchronous_standby_names` no matchea el `application_name` que la réplica reporta.

### Desde la réplica:

```sql
SELECT pg_last_wal_receive_lsn() AS recibido,
       pg_last_wal_replay_lsn()  AS aplicado;
```

Lag debe ser cercano a cero con replicación síncrona.

### Endpoint dedicado del API

El módulo expone `GET /api/v1/oficial/replicacion/estado` que devuelve un JSON con esta info para que el dashboard la muestre en una vista técnica. Ejemplo de respuesta:

```json
{
  "master_host": "oficial_master",
  "replica_host": "oficial_replica",
  "sync_state": "sync",
  "lag_bytes": 0,
  "ultima_verificacion": "2026-05-03T15:42:18Z"
}
```

## Trade-offs aceptados

- **Mayor latencia de escritura.** Cada commit espera el ack de la réplica. En la red Docker local, ~8-15 ms. Aceptable para throughput de transcripción (no es un sistema de alta concurrencia).
- **Master se bloquea si la réplica desaparece.** Comportamiento intencional. La alternativa (degradar a async) violaría RPO=0.
- **RTO mayor sin failover automático.** ~30 segundos manuales vs ~5 segundos con Patroni. Aceptable para defensa académica.

## Decisión consciente: NO implementar Patroni

Patroni es el estándar de la industria para failover automático con consenso (etcd/Consul). Lo descartamos porque:

1. Agrega un componente de consenso (etcd) que no aporta a los puntos del trabajo.
2. La complejidad operativa eclipsa el demo de failover, que es el entregable.
3. Manual `pg_promote()` evita split-brain por construcción (el operador confirma visualmente que el master cayó).

Para defensa: "We didn't implement Patroni because manual `pg_promote()` is enough for this scope and avoids the operational complexity of a consensus layer. Patroni would be the production answer; manual is the academic answer."

## Split-brain: por qué no nos pasa

Split-brain ocurre cuando dos nodos se creen primarios simultáneamente y aceptan escrituras divergentes. Con failover MANUAL no nos pasa porque:

- El operador valida visualmente que el master está caído antes de promover (`docker ps` no lo muestra).
- Cuando el master vuelve a la vida, NO arranca como primario; entra como standby con `pg_basebackup` apuntando al nuevo primario.

## Para detalles técnicos completos

Ver la skill `postgresql-mirror-replication` (en `oficial/.claude/skills/postgresql-mirror-replication/SKILL.md`). Tiene `postgresql.conf` y `pg_hba.conf` completos, comandos de verificación, frases para defensa en inglés.
