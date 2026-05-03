from fastapi import APIRouter, Query

from composition_root import ListarInconsistenciasUseCaseDep
from recuento_oficial.presentation.schemas.inconsistencias_schemas import (
    InconsistenciaResponse,
    ListaInconsistenciasResponse,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-inconsistencias"])


@router.get("/inconsistencias", response_model=ListaInconsistenciasResponse)
async def list_inconsistencias(
    use_case: ListarInconsistenciasUseCaseDep,
    tipo: str | None = Query(default=None, description="Error1|Error2|Error3|Error4"),
    codigo_mesa: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> ListaInconsistenciasResponse:
    resultado = await use_case.execute(
        tipo=tipo, codigo_mesa=codigo_mesa, page=page, limit=limit
    )
    return ListaInconsistenciasResponse(
        total=resultado.total,
        page=resultado.page,
        limit=resultado.limit,
        items=[InconsistenciaResponse.model_validate(i) for i in resultado.items],
        tipo_mas_comun=resultado.tipo_mas_comun,
    )
