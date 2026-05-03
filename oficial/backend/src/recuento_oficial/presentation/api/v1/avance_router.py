from fastapi import APIRouter

from composition_root import ConsultarAvanceUseCaseDep
from recuento_oficial.presentation.schemas.avance_schemas import AvanceResponse

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial-avance"])


@router.get("/avance", response_model=AvanceResponse)
async def get_avance(use_case: ConsultarAvanceUseCaseDep) -> AvanceResponse:
    resultado = await use_case.execute()
    return AvanceResponse.model_validate(resultado)
