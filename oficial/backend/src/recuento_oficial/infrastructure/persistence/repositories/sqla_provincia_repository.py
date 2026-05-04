from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.entities.provincia import Provincia
from recuento_oficial.infrastructure.persistence.models.provincia_orm import (
    ProvinciaORM,
)


class SqlaProvinciaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> list[Provincia]:
        stmt = select(ProvinciaORM).order_by(
            ProvinciaORM.codigo_departamento, ProvinciaORM.codigo
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [
            Provincia(
                codigo=r.codigo,
                nombre=r.nombre,
                codigo_departamento=r.codigo_departamento,
            )
            for r in rows
        ]

    async def by_codigo(self, codigo: str) -> Provincia | None:
        stmt = select(ProvinciaORM).where(ProvinciaORM.codigo == codigo)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            return None
        return Provincia(
            codigo=orm.codigo,
            nombre=orm.nombre,
            codigo_departamento=orm.codigo_departamento,
        )

    async def list_by_departamento(
        self, codigo_departamento: int
    ) -> list[Provincia]:
        stmt = (
            select(ProvinciaORM)
            .where(ProvinciaORM.codigo_departamento == codigo_departamento)
            .order_by(ProvinciaORM.codigo)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [
            Provincia(
                codigo=r.codigo,
                nombre=r.nombre,
                codigo_departamento=r.codigo_departamento,
            )
            for r in rows
        ]
