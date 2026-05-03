from recuento_oficial.domain.repositories.replicacion_repository import (
    EstadoReplicacion,
    ReplicacionRepository,
)


class ConsultarReplicacionUseCase:
    def __init__(self, repo: ReplicacionRepository) -> None:
        self._repo = repo

    async def execute(self) -> EstadoReplicacion:
        return await self._repo.consultar_estado()
