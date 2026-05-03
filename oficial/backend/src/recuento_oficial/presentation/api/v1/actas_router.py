from fastapi import APIRouter, HTTPException, Query

from composition_root import ConsultarActaUseCaseDep, ListarActasUseCaseDep
from recuento_oficial.domain.exceptions import ActaNoExisteException
from recuento_oficial.presentation.schemas.acta_oficial_schemas import (
    ActaOficialResponse,
    ListaActasResponse,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-actas"])


@router.get("/actas", response_model=ListaActasResponse)
async def list_actas(
    use_case: ListarActasUseCaseDep,
    codigo_mesa: int | None = Query(default=None),
    territorial: str | None = Query(default=None, description="Código de municipio"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> ListaActasResponse:
    resultado = await use_case.execute(
        codigo_mesa=codigo_mesa, territorial=territorial, page=page, limit=limit
    )
    return ListaActasResponse(
        total=resultado.total,
        page=resultado.page,
        limit=resultado.limit,
        pages=resultado.pages,
        items=[ActaOficialResponse.model_validate(a) for a in resultado.items],
    )


@router.get("/actas/{codigo_acta}", response_model=ActaOficialResponse)
async def get_acta(
    codigo_acta: str, use_case: ConsultarActaUseCaseDep
) -> ActaOficialResponse:
    try:
        acta = await use_case.execute(codigo_acta)
    except ActaNoExisteException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ActaOficialResponse.model_validate(acta)
