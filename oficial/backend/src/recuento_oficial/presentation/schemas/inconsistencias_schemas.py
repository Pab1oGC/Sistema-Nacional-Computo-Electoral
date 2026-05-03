from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InconsistenciaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_inconsistencia: int | None
    codigo_acta: str
    codigo_mesa: int
    tipo: str
    mensaje: str
    valores_recibidos: dict[str, int | str]
    timestamp: datetime
    resuelto: bool


class ListaInconsistenciasResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: list[InconsistenciaResponse]
    tipo_mas_comun: str | None
