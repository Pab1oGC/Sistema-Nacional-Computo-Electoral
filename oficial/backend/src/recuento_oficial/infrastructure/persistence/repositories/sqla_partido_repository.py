from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.infrastructure.persistence.mappers.partido_mapper import (
    orm_to_entity,
)
from recuento_oficial.infrastructure.persistence.models.partido_orm import PartidoORM


class SqlaPartidoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> list[Partido]:
        stmt = select(PartidoORM).order_by(PartidoORM.orden_papeleta)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [orm_to_entity(o) for o in rows]

    async def get_by_id(self, id_partido: int) -> Partido | None:
        stmt = select(PartidoORM).where(PartidoORM.id_partido == id_partido)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return orm_to_entity(orm) if orm else None
