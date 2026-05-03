from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.infrastructure.persistence.models.mesa_orm import MesaORM


class SqlaMesaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def existe(self, codigo_mesa: int) -> bool:
        stmt = select(1).select_from(MesaORM).where(
            MesaORM.codigo_mesa == codigo_mesa
        )
        return (await self._session.execute(stmt)).scalar() is not None
