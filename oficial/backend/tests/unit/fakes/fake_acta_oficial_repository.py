# Anotaciones lazy: el fake tiene un método `list` que sombrea el
# builtin `list[T]` para anotaciones siguientes. Igual que en el
# Protocol del repository real.
from __future__ import annotations

from datetime import datetime, timezone

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.entities.departamento import Departamento
from recuento_oficial.domain.entities.provincia import Provincia
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoDepto,
    ResultadoMunicipio,
    ResultadoProvincia,
)


class FakeActaOficialRepository:
    """Implementación en memoria del Protocol ActaOficialRepository."""

    def __init__(self) -> None:
        self._store: dict[int, ActaOficial] = {}
        self._next_id: int = 1
        self._depto_aggregates: list[ResultadoDepto] = []
        self._provincia_aggregates_per_depto: dict[int, list[ResultadoProvincia]] = {}
        self._municipio_aggregates_per_depto: dict[int, list[ResultadoMunicipio]] = {}
        self._departamentos_por_codigo: dict[int, Departamento] = {}
        self._provincias_por_codigo: dict[str, Provincia] = {}
        self._observaciones_count: dict[str, int] | None = None

    async def save(self, acta: ActaOficial) -> None:
        if acta.id_acta is None:
            acta.id_acta = self._next_id
            self._next_id += 1
        if acta.fecha_procesado is None:
            acta.fecha_procesado = datetime.now(timezone.utc)
        self._store[acta.id_acta] = acta

    async def get_by_id(self, id_acta: int) -> ActaOficial | None:
        return self._store.get(id_acta)

    async def get_by_codigo(self, codigo_acta: int) -> ActaOficial | None:
        for a in self._store.values():
            if a.codigo_acta == codigo_acta:
                return a
        return None

    async def exists_by_codigo(self, codigo_acta: int) -> bool:
        return any(a.codigo_acta == codigo_acta for a in self._store.values())

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
        """Helper de tests: presea la lista de agregados por departamento."""
        self._depto_aggregates = list(items)

    async def aggregate_resultados_por_departamento(
        self,
    ) -> list[ResultadoDepto]:
        return list(self._depto_aggregates)

    def set_provincia_aggregates(
        self, codigo_departamento: int, items: list[ResultadoProvincia]
    ) -> None:
        """Helper de tests: presea agregados por provincia para un depto."""
        self._provincia_aggregates_per_depto[codigo_departamento] = list(items)

    async def aggregate_resultados_por_provincia(
        self, codigo_departamento: int
    ) -> list[ResultadoProvincia]:
        return list(
            self._provincia_aggregates_per_depto.get(codigo_departamento, [])
        )

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
        """Helper de tests: presea departamento conocido."""
        self._departamentos_por_codigo[codigo] = depto

    async def departamento_por_codigo(
        self, codigo: int
    ) -> Departamento | None:
        return self._departamentos_por_codigo.get(codigo)

    def set_provincia(self, codigo: str, provincia: Provincia) -> None:
        """Helper de tests: presea provincia conocida."""
        self._provincias_por_codigo[codigo] = provincia

    async def provincia_por_codigo(
        self, codigo: str
    ) -> Provincia | None:
        return self._provincias_por_codigo.get(codigo)

    async def total_blancos(self) -> int:
        return sum(a.blancos for a in self._store.values())

    async def total_nulos(self) -> int:
        return sum(a.nulos for a in self._store.values())

    async def count_actas_validadas(self) -> int:
        return len(self._store)

    async def count_all(self) -> int:
        return len(self._store)

    async def truncate_all(self) -> None:
        self._store.clear()
        self._next_id = 1

    def set_observaciones_count(self, conteos: dict[str, int]) -> None:
        """Helper de tests: presea conteos por tipo_observacion_formal.

        Si NO se invoca, el método contar_por_tipo_observacion_formal()
        deriva los conteos del .observacion_formal de las actas en _store.
        """
        self._observaciones_count = dict(conteos)

    async def contar_por_tipo_observacion_formal(self) -> dict[str, int]:
        # Las 9 categorías del enum (ver acta_oficial_orm).
        TIPOS = (
            "FALTA_DATOS_APERTURA_CIERRE",
            "MESA_LUGAR_DISTINTO",
            "USO_FORMULARIOS_NO_OFICIALES",
            "PAPELETAS_NO_AUTORIZADAS",
            "AUSENCIA_DELEGADOS",
            "FECHA_INCORRECTA",
            "ERRORES_TRANSCRIPCION",
            "FALTA_FIRMAS_HUELLAS",
            "INCONSISTENCIA_ARITMETICA",
        )
        conteos: dict[str, int] = {t: 0 for t in TIPOS}
        if self._observaciones_count is not None:
            for t, n in self._observaciones_count.items():
                if t in conteos:
                    conteos[t] = n
            return conteos
        # Derivar de las actas en memoria.
        for a in self._store.values():
            t = a.tipo_observacion_formal
            if t in conteos:
                conteos[t] += 1
        return conteos
