from fastapi import APIRouter, HTTPException, Query

from composition_root import (
    ConsultarResultadosPorDeptoUseCaseDep,
    ConsultarResultadosPorMunicipioUseCaseDep,
    ConsultarResultadosPorProvinciaUseCaseDep,
    ConsultarResultadosUseCaseDep,
)
from recuento_oficial.domain.exceptions import DepartamentoNoExisteException
from recuento_oficial.presentation.schemas.resultados_schemas import (
    ResultadosPorDepartamentoResponse,
    ResultadosPorMunicipioResponse,
    ResultadosPorProvinciaResponse,
    ResultadosResponse,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-resultados"])


@router.get("/resultados", response_model=ResultadosResponse)
async def get_resultados(use_case: ConsultarResultadosUseCaseDep) -> ResultadosResponse:
    resultado = await use_case.execute()
    return ResultadosResponse.model_validate(resultado)


@router.get(
    "/resultados/por-departamento",
    response_model=ResultadosPorDepartamentoResponse,
)
async def get_resultados_por_departamento(
    use_case: ConsultarResultadosPorDeptoUseCaseDep,
) -> ResultadosPorDepartamentoResponse:
    resultado = await use_case.execute()
    return ResultadosPorDepartamentoResponse.model_validate(resultado)


@router.get(
    "/resultados/por-provincia",
    response_model=ResultadosPorProvinciaResponse,
)
async def get_resultados_por_provincia(
    use_case: ConsultarResultadosPorProvinciaUseCaseDep,
    departamento: int = Query(
        ...,
        ge=1,
        le=9,
        description="Código del departamento (1..9). Bolivia tiene 9 departamentos.",
    ),
) -> ResultadosPorProvinciaResponse:
    try:
        resultado = await use_case.execute(departamento)
    except DepartamentoNoExisteException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ResultadosPorProvinciaResponse.model_validate(resultado)


@router.get(
    "/resultados/por-municipio",
    response_model=ResultadosPorMunicipioResponse,
)
async def get_resultados_por_municipio(
    use_case: ConsultarResultadosPorMunicipioUseCaseDep,
    departamento: int = Query(
        ...,
        ge=1,
        le=9,
        description="Código del departamento (1..9). Bolivia tiene 9 departamentos.",
    ),
) -> ResultadosPorMunicipioResponse:
    try:
        resultado = await use_case.execute(departamento)
    except DepartamentoNoExisteException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ResultadosPorMunicipioResponse.model_validate(resultado)
