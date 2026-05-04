# Anotaciones lazy: necesario porque tenemos un método llamado `list`
# en el Protocol que sombrea el builtin `list[T]` en anotaciones que
# vengan después. Con `from __future__ import annotations`, todas las
# anotaciones son strings y se resuelven solo cuando se inspeccionan.
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.entities.departamento import Departamento
from recuento_oficial.domain.entities.provincia import Provincia


@dataclass
class ResultadoDepto:
    """Agregado por departamento devuelto por el repository."""

    id_departamento: int
    nombre_departamento: str
    total_mesas_depto: int
    actas_validadas_depto: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int


@dataclass
class ResultadoProvincia:
    """Agregado por provincia dentro de un departamento.

    Se calcula con JOIN provincia → municipio → recinto → mesa → acta.
    """

    codigo_provincia: str
    nombre_provincia: str
    total_mesas_provincia: int
    actas_validadas_provincia: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int


@dataclass
class ResultadoMunicipio:
    """Agregado por municipio devuelto por el repository.

    En schema v2 el JOIN ahora pasa por la provincia:
    departamento → provincia → municipio → recinto → mesa → acta.
    """

    codigo_municipio: str
    nombre_municipio: str
    total_mesas_municipio: int
    actas_validadas_municipio: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int


class ActaOficialRepository(Protocol):
    """Contrato de persistencia para `ActaOficial`.

    Schema v2: id_acta es BIGSERIAL autogenerado por la BD; las queries
    de lectura siguen aceptando id_acta:int como parámetro pero las
    inserciones lo dejan en None y la BD lo asigna.
    """

    async def save(self, acta: ActaOficial) -> None: ...

    async def get_by_id(self, id_acta: int) -> ActaOficial | None: ...

    async def get_by_codigo(self, codigo_acta: int) -> ActaOficial | None: ...

    async def exists_by_codigo(self, codigo_acta: int) -> bool: ...

    async def list(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[ActaOficial]: ...

    async def count(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
    ) -> int: ...

    async def aggregate_votos_por_partido(self) -> dict[int, int]: ...

    async def aggregate_resultados_por_departamento(
        self,
    ) -> list[ResultadoDepto]: ...

    async def aggregate_resultados_por_provincia(
        self, codigo_departamento: int
    ) -> list[ResultadoProvincia]: ...

    async def aggregate_resultados_por_municipio(
        self, codigo_departamento: int
    ) -> list[ResultadoMunicipio]: ...

    async def departamento_por_codigo(
        self, codigo: int
    ) -> Departamento | None: ...

    async def provincia_por_codigo(
        self, codigo: str
    ) -> Provincia | None: ...

    async def total_blancos(self) -> int: ...

    async def total_nulos(self) -> int: ...

    async def count_actas_validadas(self) -> int: ...

    async def contar_por_tipo_observacion_formal(self) -> dict[str, int]: ...

    async def count_all(self) -> int: ...

    async def truncate_all(self) -> None: ...
