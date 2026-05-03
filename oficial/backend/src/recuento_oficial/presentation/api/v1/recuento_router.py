from fastapi import APIRouter, HTTPException

# Auth deliberadamente omitida: red Docker privada, contrato del docente no la
# requiere, API no expone PII. Para producción real iría API key middleware aquí.

from composition_root import RegistrarUseCaseDep
from recuento_oficial.domain.exceptions import (
    ActaYaProcesadaException,
    ErroresDeValidacionException,
)
from recuento_oficial.presentation.schemas.acta_oficial_schemas import (
    ActaOficialResponse,
    RegistrarRecuentoRequest,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-recuento"])


@router.post(
    "/recuento",
    response_model=ActaOficialResponse,
    status_code=201,
    summary="Registra el recuento oficial de una mesa",
)
async def registrar_recuento(
    request: RegistrarRecuentoRequest,
    use_case: RegistrarUseCaseDep,
) -> ActaOficialResponse:
    try:
        acta = await use_case.execute(request.to_dto())
    except ActaYaProcesadaException as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ErroresDeValidacionException as exc:
        raise HTTPException(status_code=422, detail=exc.errores) from exc
    return ActaOficialResponse.model_validate(acta)
