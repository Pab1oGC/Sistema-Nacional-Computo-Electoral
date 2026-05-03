from typing import Protocol

from recuento_oficial.domain.entities.acta_oficial import ActaOficial


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

    async def total_blancos(self) -> int: ...

    async def total_nulos(self) -> int: ...

    async def count_actas_validadas(self) -> int: ...
