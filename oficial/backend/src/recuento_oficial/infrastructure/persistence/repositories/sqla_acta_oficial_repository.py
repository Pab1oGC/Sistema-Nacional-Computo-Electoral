# Anotaciones lazy: la clase tiene un método `list` que sombrea el
# builtin `list[T]` en anotaciones que vengan DESPUÉS del def. Igual
# patrón que en el Protocol del repository y en el fake.
from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.entities.departamento import Departamento
from recuento_oficial.domain.entities.provincia import Provincia
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoDepto,
    ResultadoMunicipio,
    ResultadoProvincia,
)
from recuento_oficial.infrastructure.persistence.mappers.acta_oficial_mapper import (
    entity_to_orm,
    orm_to_entity,
)
from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (
    ActaOficialORM,
)
from recuento_oficial.infrastructure.persistence.models.departamento_orm import (
    DepartamentoORM,
)
from recuento_oficial.infrastructure.persistence.models.mesa_orm import MesaORM
from recuento_oficial.infrastructure.persistence.models.municipio_orm import (
    MunicipioORM,
)
from recuento_oficial.infrastructure.persistence.models.provincia_orm import (
    ProvinciaORM,
)
from recuento_oficial.infrastructure.persistence.models.recinto_orm import RecintoORM


class SqlaActaOficialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, acta: ActaOficial) -> None:
        orm = entity_to_orm(acta)
        self._session.add(orm)
        await self._session.flush()
        # Tras el flush, BIGSERIAL ya asignó id_acta y server_default fijó
        # fecha_procesado. Reflejamos al entity para que el caller lo vea.
        acta.id_acta = orm.id_acta
        acta.fecha_procesado = orm.fecha_procesado

    async def get_by_id(self, id_acta: int) -> ActaOficial | None:
        stmt = select(ActaOficialORM).where(ActaOficialORM.id_acta == id_acta)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return orm_to_entity(orm) if orm else None

    async def get_by_codigo(self, codigo_acta: int) -> ActaOficial | None:
        stmt = select(ActaOficialORM).where(ActaOficialORM.codigo_acta == codigo_acta)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return orm_to_entity(orm) if orm else None

    async def exists_by_codigo(self, codigo_acta: int) -> bool:
        stmt = select(1).select_from(ActaOficialORM).where(
            ActaOficialORM.codigo_acta == codigo_acta
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
        stmt = stmt.order_by(ActaOficialORM.fecha_procesado.desc())
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

    async def aggregate_resultados_por_departamento(
        self,
    ) -> list[ResultadoDepto]:
        """Agrega votos y conteos por departamento.

        Schema v2: cadena depto → provincia → municipio → recinto → mesa,
        con LEFT JOIN a acta_oficial para que deptos sin actas aparezcan
        con conteos en cero.
        """
        stmt = (
            select(
                DepartamentoORM.codigo.label("id_departamento"),
                DepartamentoORM.nombre.label("nombre_departamento"),
                func.count(MesaORM.codigo_mesa.distinct()).label("total_mesas"),
                func.count(ActaOficialORM.id_acta.distinct()).label("actas_validadas"),
                func.coalesce(func.sum(ActaOficialORM.votos_p1), 0).label("votos_p1"),
                func.coalesce(func.sum(ActaOficialORM.votos_p2), 0).label("votos_p2"),
                func.coalesce(func.sum(ActaOficialORM.votos_p3), 0).label("votos_p3"),
                func.coalesce(func.sum(ActaOficialORM.votos_p4), 0).label("votos_p4"),
            )
            .select_from(DepartamentoORM)
            .join(
                ProvinciaORM,
                ProvinciaORM.codigo_departamento == DepartamentoORM.codigo,
            )
            .join(
                MunicipioORM,
                MunicipioORM.codigo_provincia == ProvinciaORM.codigo,
            )
            .join(
                RecintoORM, RecintoORM.codigo_municipio == MunicipioORM.codigo
            )
            .join(MesaORM, MesaORM.codigo_recinto == RecintoORM.codigo_recinto)
            .outerjoin(
                ActaOficialORM,
                ActaOficialORM.codigo_mesa == MesaORM.codigo_mesa,
            )
            .group_by(DepartamentoORM.codigo, DepartamentoORM.nombre)
            .order_by(DepartamentoORM.codigo)
        )
        result = await self._session.execute(stmt)
        return [
            ResultadoDepto(
                id_departamento=int(row.id_departamento),
                nombre_departamento=str(row.nombre_departamento),
                total_mesas_depto=int(row.total_mesas),
                actas_validadas_depto=int(row.actas_validadas),
                votos_p1=int(row.votos_p1),
                votos_p2=int(row.votos_p2),
                votos_p3=int(row.votos_p3),
                votos_p4=int(row.votos_p4),
            )
            for row in result
        ]

    async def aggregate_resultados_por_provincia(
        self, codigo_departamento: int
    ) -> list[ResultadoProvincia]:
        """Agrega votos y conteos por provincia dentro de un departamento.

        JOIN profundo: provincia → municipio → recinto → mesa, con LEFT JOIN
        a acta_oficial. Provincias sin actas igual aparecen con cero.
        """
        stmt = (
            select(
                ProvinciaORM.codigo.label("codigo_provincia"),
                ProvinciaORM.nombre.label("nombre_provincia"),
                func.count(MesaORM.codigo_mesa.distinct()).label("total_mesas"),
                func.count(ActaOficialORM.id_acta.distinct()).label("actas_validadas"),
                func.coalesce(func.sum(ActaOficialORM.votos_p1), 0).label("votos_p1"),
                func.coalesce(func.sum(ActaOficialORM.votos_p2), 0).label("votos_p2"),
                func.coalesce(func.sum(ActaOficialORM.votos_p3), 0).label("votos_p3"),
                func.coalesce(func.sum(ActaOficialORM.votos_p4), 0).label("votos_p4"),
            )
            .select_from(ProvinciaORM)
            .join(
                MunicipioORM,
                MunicipioORM.codigo_provincia == ProvinciaORM.codigo,
            )
            .join(
                RecintoORM, RecintoORM.codigo_municipio == MunicipioORM.codigo
            )
            .join(MesaORM, MesaORM.codigo_recinto == RecintoORM.codigo_recinto)
            .outerjoin(
                ActaOficialORM,
                ActaOficialORM.codigo_mesa == MesaORM.codigo_mesa,
            )
            .where(ProvinciaORM.codigo_departamento == codigo_departamento)
            .group_by(ProvinciaORM.codigo, ProvinciaORM.nombre)
            .order_by(ProvinciaORM.nombre)
        )
        result = await self._session.execute(stmt)
        return [
            ResultadoProvincia(
                codigo_provincia=str(row.codigo_provincia),
                nombre_provincia=str(row.nombre_provincia),
                total_mesas_provincia=int(row.total_mesas),
                actas_validadas_provincia=int(row.actas_validadas),
                votos_p1=int(row.votos_p1),
                votos_p2=int(row.votos_p2),
                votos_p3=int(row.votos_p3),
                votos_p4=int(row.votos_p4),
            )
            for row in result
        ]

    async def aggregate_resultados_por_municipio(
        self, codigo_departamento: int
    ) -> list[ResultadoMunicipio]:
        """Agrega votos y conteos por municipio dentro de un departamento.

        Schema v2: el filtro por departamento ahora pasa por la provincia.
        Cadena: provincia (filtrada por depto) → municipio → recinto → mesa,
        con LEFT JOIN a acta_oficial.
        """
        stmt = (
            select(
                MunicipioORM.codigo.label("codigo_municipio"),
                MunicipioORM.nombre.label("nombre_municipio"),
                func.count(MesaORM.codigo_mesa.distinct()).label("total_mesas"),
                func.count(ActaOficialORM.id_acta.distinct()).label("actas_validadas"),
                func.coalesce(func.sum(ActaOficialORM.votos_p1), 0).label("votos_p1"),
                func.coalesce(func.sum(ActaOficialORM.votos_p2), 0).label("votos_p2"),
                func.coalesce(func.sum(ActaOficialORM.votos_p3), 0).label("votos_p3"),
                func.coalesce(func.sum(ActaOficialORM.votos_p4), 0).label("votos_p4"),
            )
            .select_from(MunicipioORM)
            .join(
                ProvinciaORM,
                ProvinciaORM.codigo == MunicipioORM.codigo_provincia,
            )
            .join(
                RecintoORM, RecintoORM.codigo_municipio == MunicipioORM.codigo
            )
            .join(MesaORM, MesaORM.codigo_recinto == RecintoORM.codigo_recinto)
            .outerjoin(
                ActaOficialORM,
                ActaOficialORM.codigo_mesa == MesaORM.codigo_mesa,
            )
            .where(ProvinciaORM.codigo_departamento == codigo_departamento)
            .group_by(MunicipioORM.codigo, MunicipioORM.nombre)
            .order_by(MunicipioORM.nombre)
        )
        result = await self._session.execute(stmt)
        return [
            ResultadoMunicipio(
                codigo_municipio=str(row.codigo_municipio),
                nombre_municipio=str(row.nombre_municipio),
                total_mesas_municipio=int(row.total_mesas),
                actas_validadas_municipio=int(row.actas_validadas),
                votos_p1=int(row.votos_p1),
                votos_p2=int(row.votos_p2),
                votos_p3=int(row.votos_p3),
                votos_p4=int(row.votos_p4),
            )
            for row in result
        ]

    async def departamento_por_codigo(
        self, codigo: int
    ) -> Departamento | None:
        stmt = select(DepartamentoORM).where(DepartamentoORM.codigo == codigo)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            return None
        return Departamento(codigo=orm.codigo, nombre=orm.nombre)

    async def provincia_por_codigo(
        self, codigo: str
    ) -> Provincia | None:
        stmt = select(ProvinciaORM).where(ProvinciaORM.codigo == codigo)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            return None
        return Provincia(
            codigo=orm.codigo,
            nombre=orm.nombre,
            codigo_departamento=orm.codigo_departamento,
        )

    async def total_blancos(self) -> int:
        stmt = select(func.coalesce(func.sum(ActaOficialORM.blancos), 0))
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def total_nulos(self) -> int:
        stmt = select(func.coalesce(func.sum(ActaOficialORM.nulos), 0))
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def count_actas_validadas(self) -> int:
        stmt = select(func.count()).select_from(ActaOficialORM)
        return int((await self._session.execute(stmt)).scalar() or 0)

    async def contar_por_tipo_observacion_formal(self) -> dict[str, int]:
        """Devuelve {tipo_enum: cantidad} con los 9 valores del enum.

        Los tipos sin observaciones aparecen con cantidad=0. Garantiza
        que el dashboard recibe siempre las 9 categorías para mostrar
        consistentemente.
        """
        stmt = (
            select(
                ActaOficialORM.tipo_observacion_formal,
                func.count().label("n"),
            )
            .where(ActaOficialORM.tipo_observacion_formal.is_not(None))
            .group_by(ActaOficialORM.tipo_observacion_formal)
        )
        result = await self._session.execute(stmt)
        # Inicializamos las 9 categorías en 0 y rellenamos las que
        # tienen actas. Importamos el catálogo desde el ORM para mantener
        # una sola fuente de verdad.
        from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (
            TIPO_OBSERVACION_FORMAL_VALUES,
        )

        conteos: dict[str, int] = {t: 0 for t in TIPO_OBSERVACION_FORMAL_VALUES}
        for row in result:
            tipo = row[0]
            cantidad = int(row[1])
            if tipo is not None:
                conteos[str(tipo)] = cantidad
        return conteos

    async def count_all(self) -> int:
        return await self.count_actas_validadas()

    async def truncate_all(self) -> None:
        # RESTART IDENTITY resetea el BIGSERIAL id_acta a 1.
        # Commit explícito porque el endpoint admin no debe depender del
        # rollback automático que get_session() haría si algo más fallara
        # después en la request (acá no falla nada, pero por consistencia
        # con el patrón de inconsistencias.commit_pendiente).
        await self._session.execute(
            text("TRUNCATE TABLE oficial.acta_oficial RESTART IDENTITY")
        )
        await self._session.commit()
