from fastapi import APIRouter

from composition_root import ConsultarResultadosUseCaseDep
from recuento_oficial.presentation.schemas.resultados_schemas import (
    ResultadosResponse,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-resultados"])


@router.get("/resultados", response_model=ResultadosResponse)
async def get_resultados(use_case: ConsultarResultadosUseCaseDep) -> ResultadosResponse:
    resultado = await use_case.execute()
    return ResultadosResponse.model_validate(resultado)
