from pydantic import BaseModel, ConfigDict


class CandidatoResultadoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    candidato_id: int
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    orden_papeleta: int
    votos_total: int
    porcentaje: float


class ResultadosResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_votos_validos: int
    total_blancos: int
    total_nulos: int
    candidatos: list[CandidatoResultadoResponse]
