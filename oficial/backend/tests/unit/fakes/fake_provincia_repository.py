from __future__ import annotations

from recuento_oficial.domain.entities.provincia import Provincia


class FakeProvinciaRepository:
    """Implementación en memoria del Protocol ProvinciaRepository."""

    def __init__(self) -> None:
        self._store: dict[str, Provincia] = {}

    def add(self, provincia: Provincia) -> None:
        self._store[provincia.codigo] = provincia

    async def list_all(self) -> list[Provincia]:
        return sorted(
            self._store.values(),
            key=lambda p: (p.codigo_departamento, p.codigo),
        )

    async def by_codigo(self, codigo: str) -> Provincia | None:
        return self._store.get(codigo)

    async def list_by_departamento(
        self, codigo_departamento: int
    ) -> list[Provincia]:
        return sorted(
            (p for p in self._store.values() if p.codigo_departamento == codigo_departamento),
            key=lambda p: p.codigo,
        )
