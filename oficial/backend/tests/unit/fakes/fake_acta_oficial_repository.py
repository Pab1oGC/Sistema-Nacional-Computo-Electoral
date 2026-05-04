# Anotaciones lazy: el fake tiene un método `list` que sombrea el
# builtin `list[T]` para anotaciones siguientes. Igual que en el
# Protocol del repository real.
from __future__ import annotations

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.entities.departamento import Departamento
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoDepto,
    ResultadoMunicipio,
)


class FakeActaOficialRepository:
    """Implementación en memoria del Protocol ActaOficialRepository."""

    def __init__(self) -> None:
        self._store: dict[str, ActaOficial] = {}
        self._depto_aggregates: list[ResultadoDepto] = []
        self._municipio_aggregates_per_depto: dict[int, list[ResultadoMunicipio]] = {}
        self._departamentos_por_codigo: dict[int, Departamento] = {}

    async def save(self, acta: ActaOficial) -> None:
        self._store[acta.id_acta] = acta

    async def get_by_id(self, id_acta: str) -> ActaOficial | None:
        return self._store.get(id_acta)

    async def get_by_codigo(self, codigo_acta: str) -> ActaOficial | None:
        for a in self._store.values():
            if a.codigo_acta == codigo_acta:
                return a
        return None

    async def exists(self, id_acta: str) -> bool:
        return id_acta in self._store

    async def list(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[ActaOficial]:
        items = list(self._store.values())
        if codigo_mesa is not None:
            items = [a for a in items if a.codigo_mesa == codigo_mesa]
        start = (page - 1) * limit
        return items[start : start + limit]

    async def count(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
    ) -> int:
        items = list(self._store.values())
        if codigo_mesa is not None:
            items = [a for a in items if a.codigo_mesa == codigo_mesa]
        return len(items)

    async def aggregate_votos_por_partido(self) -> dict[int, int]:
        result = {1: 0, 2: 0, 3: 0, 4: 0}
        for a in self._store.values():
            result[1] += a.votos_p1
            result[2] += a.votos_p2
            result[3] += a.votos_p3
            result[4] += a.votos_p4
        return result

    def set_depto_aggregates(self, items: list[ResultadoDepto]) -> None:
        """Helper de tests: presea la lista de agregados por departamento.

        El fake no calcula joins reales — los tests proveen el resultado
        agregado directamente para verificar la lógica del use case.
        """
        self._depto_aggregates = list(items)

    async def aggregate_resultados_por_departamento(
        self,
    ) -> list[ResultadoDepto]:
        return list(self._depto_aggregates)

    def set_municipio_aggregates(
        self, codigo_departamento: int, items: list[ResultadoMunicipio]
    ) -> None:
        """Helper de tests: presea agregados por municipio para un depto."""
        self._municipio_aggregates_per_depto[codigo_departamento] = list(items)

    async def aggregate_resultados_por_municipio(
        self, codigo_departamento: int
    ) -> list[ResultadoMunicipio]:
        return list(
            self._municipio_aggregates_per_depto.get(codigo_departamento, [])
        )

    def set_departamento(self, codigo: int, depto: Departamento) -> None:
        """Helper de tests: presea departamento conocido para
        `departamento_por_codigo()`. Códigos no preseados retornan None.
        """
        self._departamentos_por_codigo[codigo] = depto

    async def departamento_por_codigo(
        self, codigo: int
    ) -> Departamento | None:
        return self._departamentos_por_codigo.get(codigo)

    async def total_blancos(self) -> int:
        return sum(a.blancos for a in self._store.values())

    async def total_nulos(self) -> int:
        return sum(a.nulos for a in self._store.values())

    async def count_actas_validadas(self) -> int:
        return len(self._store)
