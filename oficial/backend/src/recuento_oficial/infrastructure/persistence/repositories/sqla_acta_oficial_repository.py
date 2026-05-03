from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.infrastructure.persistence.mappers.acta_oficial_mapper import (
    entity_to_orm,
    orm_to_entity,
)
from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (
    ActaOficialORM,
)
from recuento_oficial.infrastructure.persistence.models.mesa_orm import MesaORM
from recuento_oficial.infrastructure.persistence.models.recinto_orm import RecintoORM


class SqlaActaOficialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, acta: ActaOficial) -> None:
        self._session.add(entity_to_orm(acta))
        await self._session.flush()

    async def get_by_id(self, id_acta: str) -> ActaOficial | None:
        stmt = select(ActaOficialORM).where(ActaOficialORM.id_acta == id_acta)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return orm_to_entity(orm) if orm else None

    async def get_by_codigo(self, codigo_acta: str) -> ActaOficial | None:
        stmt = select(ActaOficialORM).where(ActaOficialORM.codigo_acta == codigo_acta)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return orm_to_entity(orm) if orm else None

    async def exists(self, id_acta: str) -> bool:
        stmt = select(1).select_from(ActaOficialORM).where(
            ActaOficialORM.id_acta == id_acta
        )
        return (await self._session.execute(stmt)).scalar() is not None

    async def list(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[ActaOficial]:
        stmt = self._build_filtered_query(codigo_mesa, territorial)
        stmt = stmt.order_by(ActaOficialORM.fecha_creacion.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [orm_to_entity(o) for o in rows]

    async def count(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
    ) -> int:
        stmt = self._build_filtered_query(codigo_mesa, territorial)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        return int((await self._session.execute(count_stmt)).scalar() or 0)

    @staticmethod
    def _build_filtered_query(codigo_mesa: int | None, territorial: str | None):
        stmt = select(ActaOficialORM)
        if codigo_mesa is not None:
            stmt = stmt.where(ActaOficialORM.codigo_mesa == codigo_mesa)
        if territorial is not None:
            stmt = (
                stmt.join(MesaORM, MesaORM.codigo_mesa == ActaOficialORM.codigo_mesa)
                .join(RecintoORM, RecintoORM.codigo_recinto == MesaORM.codigo_recinto)
                .where(RecintoORM.codigo_municipio == territorial)
            )
        return stmt

    async def aggregate_votos_por_partido(self) -> dict[int, int]:
        stmt = select(
            func.coalesce(func.sum(ActaOficialORM.votos_p1), 0),
            func.coalesce(func.sum(ActaOficialORM.votos_p2), 0),
            func.coalesce(func.sum(ActaOficialORM.votos_p3), 0),
            func.coalesce(func.sum(ActaOficialORM.votos_p4), 0),
        )
        row = (await self._session.execute(stmt)).one()
        return {1: int(row[0]), 2: int(row[1]), 3: int(row[2]), 4: int(row[3])}

    async def total_blancos(self) -> int:
        stmt = select(func.coalesce(func.sum(ActaOficialORM.blancos), 0))
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def total_nulos(self) -> int:
        stmt = select(func.coalesce(func.sum(ActaOficialORM.nulos), 0))
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def count_actas_validadas(self) -> int:
        stmt = select(func.count()).select_from(ActaOficialORM)
        return int((await self._session.execute(stmt)).scalar() or 0)
