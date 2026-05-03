from dataclasses import dataclass

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.exceptions import ActaNoExisteException
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)


@dataclass
class ListarActasResultado:
    total: int
    page: int
    limit: int
    pages: int
    items: list[ActaOficial]


class ListarActasUseCase:
    def __init__(self, repo: ActaOficialRepository) -> None:
        self._repo = repo

    async def execute(
        self,
        codigo_mesa: int | None = None,
        territorial: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> ListarActasResultado:
        total = await self._repo.count(
            codigo_mesa=codigo_mesa, territorial=territorial
        )
        items = await self._repo.list(
            codigo_mesa=codigo_mesa,
            territorial=territorial,
            page=page,
            limit=limit,
        )
        pages = -(-total // limit) if limit else 0
        return ListarActasResultado(
            total=total, page=page, limit=limit, pages=pages, items=items
        )


class ConsultarActaUseCase:
    def __init__(self, repo: ActaOficialRepository) -> None:
        self._repo = repo

    async def execute(self, codigo_acta: str) -> ActaOficial:
        acta = await self._repo.get_by_codigo(codigo_acta)
        if acta is None:
            raise ActaNoExisteException(codigo_acta)
        return acta
