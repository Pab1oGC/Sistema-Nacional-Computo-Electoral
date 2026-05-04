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


# ─── /resultados/por-departamento ──────────────────────────────────────


class CandidatoVotosDeptoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sigla_candidato: str
    votos: int
    porcentaje: float


class GanadorDeptoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    votos: int
    porcentaje: float


class DepartamentoResultadosResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_departamento: int
    nombre_departamento: str
    total_mesas_depto: int
    actas_validadas_depto: int
    porcentaje_avance_depto: float
    ganador: GanadorDeptoResponse | None
    resultados_candidatos: list[CandidatoVotosDeptoResponse]


class ResultadosPorDepartamentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    departamentos: list[DepartamentoResultadosResponse]


# ─── /resultados/por-municipio?departamento=N ──────────────────────────


class CandidatoVotosMunicipioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sigla_candidato: str
    votos: int
    porcentaje: float


class GanadorMunicipioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    votos: int
    porcentaje: float


class MunicipioResultadosResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_municipio: int
    codigo_municipio: str
    nombre_municipio: str
    total_mesas_municipio: int
    actas_validadas_municipio: int
    porcentaje_avance_municipio: float
    ganador: GanadorMunicipioResponse | None
    resultados_candidatos: list[CandidatoVotosMunicipioResponse]


class DepartamentoBriefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    codigo: int
    nombre: str


class ResultadosPorMunicipioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    departamento: DepartamentoBriefResponse
    municipios: list[MunicipioResultadosResponse]


# ─── /resultados/por-provincia?departamento=N ──────────────────────────


class CandidatoVotosProvinciaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sigla_candidato: str
    votos: int
    porcentaje: float


class GanadorProvinciaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    votos: int
    porcentaje: float


class ProvinciaResultadosResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    codigo_provincia: str
    nombre_provincia: str
    total_mesas_provincia: int
    actas_validadas_provincia: int
    porcentaje_avance_provincia: float
    ganador: GanadorProvinciaResponse | None
    resultados_candidatos: list[CandidatoVotosProvinciaResponse]


class ResultadosPorProvinciaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    departamento: DepartamentoBriefResponse
    provincias: list[ProvinciaResultadosResponse]
