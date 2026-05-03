from collections import Counter

from recuento_oficial.domain.repositories.inconsistencia_repository import (
    Inconsistencia,
)


class FakeInconsistenciaRepository:
    def __init__(self) -> None:
        self._store: list[Inconsistencia] = []
        self._next_id = 1
        self._commits_invocados = 0

    async def save(self, inc: Inconsistencia) -> None:
        inc.id_inconsistencia = self._next_id
        self._next_id += 1
        self._store.append(inc)

    async def commit_pendiente(self) -> None:
        """No-op en memoria: no hay transacciones que confirmar.

        Mantenemos un contador para que tests puedan asertar que el use
        case llamó al método (verificación contractual con el repository
        SQLAlchemy real).
        """
        self._commits_invocados += 1

    def get_commits_count(self) -> int:
        return self._commits_invocados

    async def list(
        self,
        tipo: str | None = None,
        codigo_mesa: int | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[Inconsistencia]:
        items = list(self._store)
        if tipo is not None:
            items = [i for i in items if i.tipo == tipo]
        if codigo_mesa is not None:
            items = [i for i in items if i.codigo_mesa == codigo_mesa]
        start = (page - 1) * limit
        return items[start : start + limit]

    async def count(
        self, tipo: str | None = None, codigo_mesa: int | None = None
    ) -> int:
        items = list(self._store)
        if tipo is not None:
            items = [i for i in items if i.tipo == tipo]
        if codigo_mesa is not None:
            items = [i for i in items if i.codigo_mesa == codigo_mesa]
        return len(items)

    async def tipo_mas_comun(self) -> str | None:
        if not self._store:
            return None
        counter = Counter(i.tipo for i in self._store)
        return counter.most_common(1)[0][0]
