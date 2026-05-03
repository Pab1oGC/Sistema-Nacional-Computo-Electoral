from fastapi import APIRouter, HTTPException

from composition_root import ConsultarReplicacionUseCaseDep
from recuento_oficial.domain.exceptions import ReplicaNoDisponibleException
from recuento_oficial.presentation.schemas.replicacion_schemas import (
    ReplicacionEstadoResponse,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-replicacion"])


@router.get("/replicacion/estado", response_model=ReplicacionEstadoResponse)
async def get_estado_replicacion(
    use_case: ConsultarReplicacionUseCaseDep,
) -> ReplicacionEstadoResponse:
    try:
        estado = await use_case.execute()
    except ReplicaNoDisponibleException as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ReplicacionEstadoResponse.model_validate(estado)
