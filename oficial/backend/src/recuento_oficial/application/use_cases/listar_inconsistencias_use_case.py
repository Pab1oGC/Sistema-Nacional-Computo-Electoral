from dataclasses import dataclass

from recuento_oficial.domain.repositories.inconsistencia_repository import (
    Inconsistencia,
    InconsistenciaRepository,
)


@dataclass
class ListarInconsistenciasResultado:
    total: int
    page: int
    limit: int
    items: list[Inconsistencia]
    tipo_mas_comun: str | None


class ListarInconsistenciasUseCase:
    def __init__(self, repo: InconsistenciaRepository) -> None:
        self._repo = repo

    async def execute(
        self,
        tipo: str | None = None,
        codigo_mesa: int | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> ListarInconsistenciasResultado:
        total = await self._repo.count(tipo=tipo, codigo_mesa=codigo_mesa)
        items = await self._repo.list(
            tipo=tipo, codigo_mesa=codigo_mesa, page=page, limit=limit
        )
        tipo_mas_comun = await self._repo.tipo_mas_comun()
        return ListarInconsistenciasResultado(
            total=total,
            page=page,
            limit=limit,
            items=items,
            tipo_mas_comun=tipo_mas_comun,
        )
