from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.domain.repositories.partido_repository import (
    PartidoRepository,
)


class ListarCandidatosUseCase:
    def __init__(self, repo: PartidoRepository) -> None:
        self._repo = repo

    async def execute(self) -> list[Partido]:
        partidos = await self._repo.list_all()
        partidos.sort(key=lambda p: p.orden_papeleta)
        return partidos
