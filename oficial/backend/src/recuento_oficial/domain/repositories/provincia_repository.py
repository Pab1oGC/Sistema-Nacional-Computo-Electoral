from __future__ import annotations

from typing import Protocol

from recuento_oficial.domain.entities.provincia import Provincia


class ProvinciaRepository(Protocol):
    """Contrato de persistencia para `Provincia`.

    Implementación concreta vive en infrastructure/persistence/repositories.
    Implementación fake para tests vive en tests/unit/fakes.
    """

    async def list_all(self) -> list[Provincia]: ...

    async def by_codigo(self, codigo: str) -> Provincia | None: ...

    async def list_by_departamento(
        self, codigo_departamento: int
    ) -> list[Provincia]: ...
