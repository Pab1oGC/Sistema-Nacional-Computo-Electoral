from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ResetActasResponse(BaseModel):
    """Respuesta del endpoint admin /reset-actas."""

    model_config = ConfigDict(from_attributes=True)

    ok: bool = True
    rows_truncated: dict[str, int]
    timestamp: datetime
