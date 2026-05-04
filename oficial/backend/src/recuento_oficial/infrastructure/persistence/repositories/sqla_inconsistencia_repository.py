from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.repositories.inconsistencia_repository import (
    Inconsistencia,
)
from recuento_oficial.infrastructure.persistence.models.inconsistencia_orm import (
    InconsistenciaORM,
)


class SqlaInconsistenciaRepository:
    """Persistencia de inconsistencias en oficial.log_inconsistencias (v2).

    Las columnas en BD se renombraron entre v1 y v2 (ver inconsistencia_orm).
    El entity Inconsistencia mantiene los nombres lógicos del dominio
    (codigo_acta, codigo_mesa, mensaje, valores_recibidos, timestamp,
    resuelto). La traducción entity↔ORM ocurre acá.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, inc: Inconsistencia) -> None:
        # codigo_acta es str a nivel de dominio (id legible). En v2 la
        # columna es BIGINT: si parsea como entero lo guardamos como tal,
        # si no, queda 0 como sentinel y el detalle preserva el texto.
        try:
            cod_acta_int = int(inc.codigo_acta)
        except (TypeError, ValueError):
            cod_acta_int = 0
        # La columna oficial.log_inconsistencias.fecha es TIMESTAMP WITHOUT
        # TIME ZONE (schema v2). asyncpg rechaza datetime tz-aware contra
        # columnas naive. Normalizamos a naive UTC en el adapter.
        fecha = (
            inc.timestamp.replace(tzinfo=None)
            if inc.timestamp.tzinfo is not None
            else inc.timestamp
        )
        orm = InconsistenciaORM(
            codigo_acta_intentado=cod_acta_int,
            codigo_mesa_intentado=inc.codigo_mesa,
            tipo=inc.tipo,
            detalle=inc.mensaje,
            payload_json=inc.valores_recibidos,
            fecha=fecha,
        )
        self._session.add(orm)
        await self._session.flush()

    async def commit_pendiente(self) -> None:
        """Commit explícito de la inconsistencia para que sobreviva al
        rollback automático que `get_session()` ejecuta cuando el use
        case lanza una excepción de dominio.

        Este método es una excepción consciente al patrón Unit of Work:
        normalmente la gestión transaccional vive solo en
        `get_session()`. Pero el audit trail de inconsistencias DEBE
        persistir incluso cuando la request termina con error (404,
        422), porque en un sistema oficial "rejection without audit" es
        inaceptable.
        """
        await self._session.commit()

    async def list(
        self,
        tipo: str | None = None,
        codigo_mesa: int | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[Inconsistencia]:
        stmt = self._build_query(tipo, codigo_mesa)
        stmt = stmt.order_by(InconsistenciaORM.fecha.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [self._orm_to_entity(o) for o in rows]

    async def count(
        self, tipo: str | None = None, codigo_mesa: int | None = None
    ) -> int:
        stmt = self._build_query(tipo, codigo_mesa)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        return int((await self._session.execute(count_stmt)).scalar() or 0)

    async def count_all(self) -> int:
        stmt = select(func.count()).select_from(InconsistenciaORM)
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def truncate_all(self) -> None:
        await self._session.execute(
            text("TRUNCATE TABLE oficial.log_inconsistencias RESTART IDENTITY")
        )
        await self._session.commit()

    async def tipo_mas_comun(self) -> str | None:
        """Consulta 20 del enunciado: error más común en verificación."""
        stmt = (
            select(InconsistenciaORM.tipo, func.count().label("n"))
            .group_by(InconsistenciaORM.tipo)
            .order_by(func.count().desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        row = result.first()
        return str(row[0]) if row else None

    @staticmethod
    def _build_query(tipo: str | None, codigo_mesa: int | None):
        stmt = select(InconsistenciaORM)
        if tipo is not None:
            stmt = stmt.where(InconsistenciaORM.tipo == tipo)
        if codigo_mesa is not None:
            stmt = stmt.where(InconsistenciaORM.codigo_mesa_intentado == codigo_mesa)
        return stmt

    @staticmethod
    def _orm_to_entity(orm: InconsistenciaORM) -> Inconsistencia:
        # Schema v2 no tiene columna `resuelto` ni `id_inconsistencia` con
        # ese nombre — usamos id_log como id_inconsistencia y resuelto=False
        # por defecto (el dominio aún expone el flag para compat con el
        # endpoint, pero ya no se persiste).
        return Inconsistencia(
            id_inconsistencia=orm.id_log,
            codigo_acta=str(orm.codigo_acta_intentado),
            codigo_mesa=orm.codigo_mesa_intentado or 0,
            tipo=orm.tipo,
            mensaje=orm.detalle,
            valores_recibidos=dict(orm.payload_json or {}),
            timestamp=orm.fecha,
            resuelto=False,
        )
