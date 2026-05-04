from dataclasses import dataclass

from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.domain.exceptions import DepartamentoNoExisteException
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
    ResultadoMunicipio,
)
from recuento_oficial.domain.repositories.partido_repository import (
    PartidoRepository,
)


@dataclass
class CandidatoVotosMunicipio:
    sigla_candidato: str
    votos: int
    porcentaje: float


@dataclass
class GanadorMunicipio:
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    votos: int
    porcentaje: float


@dataclass
class MunicipioResultados:
    id_municipio: int
    codigo_municipio: str
    nombre_municipio: str
    total_mesas_municipio: int
    actas_validadas_municipio: int
    porcentaje_avance_municipio: float
    ganador: GanadorMunicipio | None
    resultados_candidatos: list[CandidatoVotosMunicipio]


@dataclass
class DepartamentoBrief:
    codigo: int
    nombre: str


@dataclass
class ResultadosPorMunicipio:
    departamento: DepartamentoBrief
    municipios: list[MunicipioResultados]


class ConsultarResultadosPorMunicipioUseCase:
    """Compone los agregados de municipios (raw del repo) con el catálogo
    de partidos. Filtra por código de departamento.

    Si el departamento no existe en el catálogo OEP, lanza
    DepartamentoNoExisteException para que el router responda 404.
    """

    def __init__(
        self,
        acta_repo: ActaOficialRepository,
        partido_repo: PartidoRepository,
    ) -> None:
        self._actas = acta_repo
        self._partidos = partido_repo

    async def execute(self, codigo_departamento: int) -> ResultadosPorMunicipio:
        depto = await self._actas.departamento_por_codigo(codigo_departamento)
        if depto is None:
            raise DepartamentoNoExisteException(codigo_departamento)

        partidos = await self._partidos.list_all()
        partidos.sort(key=lambda p: p.orden_papeleta)
        agregados = await self._actas.aggregate_resultados_por_municipio(
            codigo_departamento
        )

        municipios = [self._build_municipio(raw, partidos) for raw in agregados]
        return ResultadosPorMunicipio(
            departamento=DepartamentoBrief(codigo=depto.codigo, nombre=depto.nombre),
            municipios=municipios,
        )

    @staticmethod
    def _build_municipio(
        raw: ResultadoMunicipio, partidos: list[Partido]
    ) -> MunicipioResultados:
        votos_por_id = {
            1: raw.votos_p1,
            2: raw.votos_p2,
            3: raw.votos_p3,
            4: raw.votos_p4,
        }
        total_validos = sum(votos_por_id.values())

        resultados = [
            CandidatoVotosMunicipio(
                sigla_candidato=p.sigla_candidato,
                votos=votos_por_id.get(p.id_partido, 0),
                porcentaje=_pct(
                    votos_por_id.get(p.id_partido, 0), total_validos
                ),
            )
            for p in partidos
        ]

        ganador: GanadorMunicipio | None = None
        if total_validos > 0:
            top = max(partidos, key=lambda p: votos_por_id.get(p.id_partido, 0))
            top_votos = votos_por_id.get(top.id_partido, 0)
            ganador = GanadorMunicipio(
                sigla_candidato=top.sigla_candidato,
                nombre_candidato=top.nombre_candidato,
                sigla_partido=top.sigla_partido,
                color_hex=top.color_hex,
                votos=top_votos,
                porcentaje=_pct(top_votos, total_validos),
            )

        porcentaje_avance = _pct(
            raw.actas_validadas_municipio, raw.total_mesas_municipio
        )

        return MunicipioResultados(
            id_municipio=_codigo_a_int(raw.codigo_municipio),
            codigo_municipio=raw.codigo_municipio,
            nombre_municipio=raw.nombre_municipio,
            total_mesas_municipio=raw.total_mesas_municipio,
            actas_validadas_municipio=raw.actas_validadas_municipio,
            porcentaje_avance_municipio=porcentaje_avance,
            ganador=ganador,
            resultados_candidatos=resultados,
        )


def _pct(numerador: int, denominador: int) -> float:
    if denominador <= 0:
        return 0.0
    return round(numerador / denominador * 100, 2)


def _codigo_a_int(codigo_municipio: str) -> int:
    """Convierte el codigo VARCHAR a int. Para compatibilidad con frontends
    que esperan id_municipio entero. Si falla, devuelve 0.
    """
    try:
        return int(codigo_municipio)
    except (TypeError, ValueError):
        return 0
