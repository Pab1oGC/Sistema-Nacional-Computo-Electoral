import os

from fastapi import APIRouter, HTTPException, Query

from composition_root import ResetActasUseCaseDep
from recuento_oficial.presentation.schemas.admin_schemas import ResetActasResponse

# El prefix /api/v1/oficial/admin se compone con el include_router del main.
router = APIRouter(prefix="/api/v1/oficial/admin", tags=["oficial-admin"])

CONFIRMATION_TOKEN = "YES_DELETE_ALL"


@router.post("/reset-actas", response_model=ResetActasResponse)
async def reset_actas(
    use_case: ResetActasUseCaseDep,
    confirm: str = Query(
        ...,
        description=f"Must be exactly '{CONFIRMATION_TOKEN}'",
    ),
) -> ResetActasResponse:
    """Trunca acta_oficial, log_inconsistencias y actas_descartadas.

    Doble gating:
      1. La variable de entorno ADMIN_RESET_ENABLED debe estar en 'true'.
         Si no lo está, devuelve 503.
      2. El query param confirm debe ser exactamente 'YES_DELETE_ALL'.
         Si no lo es, devuelve 403.

    Pensado para que n8n alterne perfiles de carga durante la demo. La
    red interna Docker (rrv-net) es el primer nivel de aislamiento; este
    doble gate evita el "oops" típico de pegarle al endpoint accidentalmente
    desde un test o curl exploratorio.
    """
    if os.environ.get("ADMIN_RESET_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail=(
                "Admin endpoint disabled. "
                "Set ADMIN_RESET_ENABLED=true in API container env."
            ),
        )

    if confirm != CONFIRMATION_TOKEN:
        raise HTTPException(
            status_code=403,
            detail="Missing or invalid confirmation token",
        )

    resultado = await use_case.execute()
    return ResetActasResponse.model_validate(resultado)
