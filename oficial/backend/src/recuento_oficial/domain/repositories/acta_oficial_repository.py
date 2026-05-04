# Anotaciones lazy: necesario porque tenemos un método llamado `list`
# en el Protocol que sombrea el builtin `list[T]` en anotaciones que
# vengan después. Con `from __future__ import annotations`, todas las
# anotaciones son strings y se resuelven solo cuando se inspeccionan.
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.entities.departamento import Departamento


@dataclass
class ResultadoDepto:
    """Agregado por departamento devuelto por el repository.

    Es el "raw" de la query: el use case lo compone con datos de partidos
    para producir el DTO de respuesta del endpoint.
    """

    id_departamento: int
    nombre_departamento: str
    total_mesas_depto: int
    actas_validadas_depto: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int


@dataclass
class ResultadoMunicipio:
    """Agregado por municipio devuelto por el repository.

    Mismo patrón que ResultadoDepto pero filtrando por
    municipio.codigo_departamento.
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

    Implementación concreta vive en infrastructure/persistence/repositories.
    Implementación fake para tests vive en tests/unit/fakes.
    """

    async def save(self, acta: ActaOficial) -> None: ...

    async def get_by_id(self, id_acta: str) -> ActaOficial | None: ...

    async def get_by_codigo(self, codigo_acta: str) -> ActaOficial | None: ...

    async def exists(self, id_acta: str) -> bool: ...

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

    async def aggregate_resultados_por_municipio(
        self, codigo_departamento: int
    ) -> list[ResultadoMunicipio]: ...

    async def departamento_por_codigo(
        self, codigo: int
    ) -> Departamento | None: ...

    async def total_blancos(self) -> int: ...

    async def total_nulos(self) -> int: ...

    async def count_actas_validadas(self) -> int: ...
