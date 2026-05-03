from typing import Protocol

from recuento_oficial.domain.entities.partido import Partido


class PartidoRepository(Protocol):
    async def list_all(self) -> list[Partido]: ...

    async def get_by_id(self, id_partido: int) -> Partido | None: ...
