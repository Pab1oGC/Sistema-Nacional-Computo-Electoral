from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.infrastructure.persistence.models.acta_descartada_orm import (
    ActaDescartadaORM,
)


class SqlaActasDescartadasRepository:
    """Implementación SQLAlchemy de ActasDescartadasRepository.

    Solo expone count + truncate. Las inserciones a oficial.actas_descartadas
    se hacen vía pipelines de ingest fuera de este repository.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def count_all(self) -> int:
        stmt = select(func.count()).select_from(ActaDescartadaORM)
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def truncate_all(self) -> None:
        await self._session.execute(
            text("TRUNCATE TABLE oficial.actas_descartadas RESTART IDENTITY")
        )
        await self._session.commit()
