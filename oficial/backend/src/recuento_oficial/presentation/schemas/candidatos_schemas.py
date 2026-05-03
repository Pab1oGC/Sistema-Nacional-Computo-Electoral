from pydantic import BaseModel, ConfigDict


class CandidatoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_partido: int
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    orden_papeleta: int


class ListaCandidatosResponse(BaseModel):
    candidatos: list[CandidatoResponse]
