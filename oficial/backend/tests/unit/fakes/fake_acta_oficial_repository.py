from recuento_oficial.domain.entities.acta_oficial import ActaOficial


class FakeActaOficialRepository:
    """Implementación en memoria del Protocol ActaOficialRepository."""

    def __init__(self) -> None:
        self._store: dict[str, ActaOficial] = {}

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

    async def total_blancos(self) -> int:
        return sum(a.blancos for a in self._store.values())

    async def total_nulos(self) -> int:
        return sum(a.nulos for a in self._store.values())

    async def count_actas_validadas(self) -> int:
        return len(self._store)
