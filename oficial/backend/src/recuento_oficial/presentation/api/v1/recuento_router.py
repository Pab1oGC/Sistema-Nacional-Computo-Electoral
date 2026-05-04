from fastapi import APIRouter, HTTPException

# Auth deliberadamente omitida: red Docker privada, contrato del docente no la
# requiere, API no expone PII. Para producción real iría API key middleware aquí.

from composition_root import RegistrarUseCaseDep
from recuento_oficial.domain.exceptions import (
    ActaNoExisteException,
    ActaYaProcesadaException,
    ErroresDeValidacionException,
    InconsistenciaNumericaException,
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
    except InconsistenciaNumericaException as exc:
        # 400 con tipo explícito para que el cliente (n8n, frontend) pueda
        # categorizar sin parsear texto libre.
        raise HTTPException(
            status_code=400,
            detail={
                "tipo": "INCONSISTENCIA_NUMERICA",
                "detail": str(exc),
            },
        ) from exc
    except ActaNoExisteException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ActaYaProcesadaException as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ErroresDeValidacionException as exc:
        raise HTTPException(status_code=422, detail=exc.errores) from exc
    return ActaOficialResponse.model_validate(acta)
