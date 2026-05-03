from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AvanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_mesas: int
    actas_validadas: int
    actas_pendientes: int
    porcentaje_avance: float
    ultima_actualizacion: datetime
