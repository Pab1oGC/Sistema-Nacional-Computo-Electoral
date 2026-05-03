from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.repositories.inconsistencia_repository import (
    Inconsistencia,
)
from recuento_oficial.infrastructure.persistence.models.inconsistencia_orm import (
    InconsistenciaORM,
)


class SqlaInconsistenciaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, inc: Inconsistencia) -> None:
        orm = InconsistenciaORM(
            codigo_acta=inc.codigo_acta,
            codigo_mesa=inc.codigo_mesa,
            tipo=inc.tipo,
            mensaje=inc.mensaje,
            valores_recibidos=inc.valores_recibidos,
            timestamp=inc.timestamp,
            resuelto=inc.resuelto,
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

        El trade-off: ligera ruptura del patrón a cambio de garantía
        audit-completa. Aceptable en este caso por el dominio (datos
        electorales legalmente vinculantes).

        Efecto colateral: tras este commit la sesión queda sin
        transacción abierta. El `rollback()` posterior de
        `get_session()` (al manejar la excepción del use case) será
        no-op sobre la inconsistencia ya persistida.
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
        stmt = stmt.order_by(InconsistenciaORM.timestamp.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [self._orm_to_entity(o) for o in rows]

    async def count(
        self, tipo: str | None = None, codigo_mesa: int | None = None
    ) -> int:
        stmt = self._build_query(tipo, codigo_mesa)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        return int((await self._session.execute(count_stmt)).scalar() or 0)

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
            stmt = stmt.where(InconsistenciaORM.codigo_mesa == codigo_mesa)
        return stmt

    @staticmethod
    def _orm_to_entity(orm: InconsistenciaORM) -> Inconsistencia:
        return Inconsistencia(
            id_inconsistencia=orm.id_inconsistencia,
            codigo_acta=orm.codigo_acta,
            codigo_mesa=orm.codigo_mesa,
            tipo=orm.tipo,
            mensaje=orm.mensaje,
            valores_recibidos=dict(orm.valores_recibidos),
            timestamp=orm.timestamp,
            resuelto=orm.resuelto,
        )
