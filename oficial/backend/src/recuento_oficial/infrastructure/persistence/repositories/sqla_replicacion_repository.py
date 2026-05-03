from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.exceptions import ReplicaNoDisponibleException
from recuento_oficial.domain.repositories.replicacion_repository import (
    EstadoReplicacion,
)


class SqlaReplicacionRepository:
    """Consulta `pg_stat_replication` desde el master.

    Devuelve estado de la réplica `oficial_replica` configurada como standby
    síncrono (ver oficial/docs/architecture/05-replication-mirror.md).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def consultar_estado(self) -> EstadoReplicacion:
        stmt = text(
            """
            SELECT application_name,
                   client_addr::text AS client_addr,
                   state,
                   sync_state,
                   COALESCE(pg_wal_lsn_diff(sent_lsn, replay_lsn), 0)::bigint AS lag_bytes
              FROM pg_stat_replication
             WHERE application_name = :app_name
             LIMIT 1
            """
        )
        result = await self._session.execute(stmt, {"app_name": "oficial_replica"})
        row = result.mappings().first()

        if row is None:
            raise ReplicaNoDisponibleException(
                "No hay standby con application_name='oficial_replica' conectado al master"
            )

        return EstadoReplicacion(
            master_host="oficial_master",
            replica_host=row["client_addr"],
            sync_state=row["sync_state"],
            state=row["state"],
            lag_bytes=int(row["lag_bytes"]),
            ultima_verificacion=datetime.now(timezone.utc),
        )
