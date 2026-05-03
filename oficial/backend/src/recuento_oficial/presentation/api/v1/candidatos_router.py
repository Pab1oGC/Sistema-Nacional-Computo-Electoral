from fastapi import APIRouter

from composition_root import ListarCandidatosUseCaseDep
from recuento_oficial.presentation.schemas.candidatos_schemas import (
    CandidatoResponse,
    ListaCandidatosResponse,
)

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-candidatos"])


@router.get("/candidatos", response_model=ListaCandidatosResponse)
async def list_candidatos(
    use_case: ListarCandidatosUseCaseDep,
) -> ListaCandidatosResponse:
    partidos = await use_case.execute()
    return ListaCandidatosResponse(
        candidatos=[CandidatoResponse.model_validate(p) for p in partidos]
    )
