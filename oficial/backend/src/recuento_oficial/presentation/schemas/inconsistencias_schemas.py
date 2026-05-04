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


# ─── /inconsistencias/observaciones-formales ───────────────────────────


class ConteoObservacionFormalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tipo: str
    cantidad: int
    descripcion_humana: str


class ObservacionesFormalesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total: int
    conteos_por_tipo: list[ConteoObservacionFormalResponse]
