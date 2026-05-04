from dataclasses import dataclass

from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.domain.exceptions import DepartamentoNoExisteException
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
    ResultadoProvincia,
)
from recuento_oficial.domain.repositories.partido_repository import (
    PartidoRepository,
)


@dataclass
class CandidatoVotosProvincia:
    sigla_candidato: str
    votos: int
    porcentaje: float


@dataclass
class GanadorProvincia:
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    votos: int
    porcentaje: float


@dataclass
class ProvinciaResultados:
    codigo_provincia: str
    nombre_provincia: str
    total_mesas_provincia: int
    actas_validadas_provincia: int
    porcentaje_avance_provincia: float
    ganador: GanadorProvincia | None
    resultados_candidatos: list[CandidatoVotosProvincia]


@dataclass
class DepartamentoBrief:
    codigo: int
    nombre: str


@dataclass
class ResultadosPorProvincia:
    departamento: DepartamentoBrief
    provincias: list[ProvinciaResultados]


class ConsultarResultadosPorProvinciaUseCase:
    """Compone los agregados de provincias (raw del repo) con el catálogo
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

    async def execute(self, codigo_departamento: int) -> ResultadosPorProvincia:
        depto = await self._actas.departamento_por_codigo(codigo_departamento)
        if depto is None:
            raise DepartamentoNoExisteException(codigo_departamento)

        partidos = await self._partidos.list_all()
        partidos.sort(key=lambda p: p.orden_papeleta)
        agregados = await self._actas.aggregate_resultados_por_provincia(
            codigo_departamento
        )

        provincias = [self._build_provincia(raw, partidos) for raw in agregados]
        return ResultadosPorProvincia(
            departamento=DepartamentoBrief(codigo=depto.codigo, nombre=depto.nombre),
            provincias=provincias,
        )

    @staticmethod
    def _build_provincia(
        raw: ResultadoProvincia, partidos: list[Partido]
    ) -> ProvinciaResultados:
        votos_por_id = {
            1: raw.votos_p1,
            2: raw.votos_p2,
            3: raw.votos_p3,
            4: raw.votos_p4,
        }
        total_validos = sum(votos_por_id.values())

        resultados = [
            CandidatoVotosProvincia(
                sigla_candidato=p.sigla_candidato,
                votos=votos_por_id.get(p.id_partido, 0),
                porcentaje=_pct(
                    votos_por_id.get(p.id_partido, 0), total_validos
                ),
            )
            for p in partidos
        ]

        ganador: GanadorProvincia | None = None
        if total_validos > 0:
            top = max(partidos, key=lambda p: votos_por_id.get(p.id_partido, 0))
            top_votos = votos_por_id.get(top.id_partido, 0)
            ganador = GanadorProvincia(
                sigla_candidato=top.sigla_candidato,
                nombre_candidato=top.nombre_candidato,
                sigla_partido=top.sigla_partido,
                color_hex=top.color_hex,
                votos=top_votos,
                porcentaje=_pct(top_votos, total_validos),
            )

        porcentaje_avance = _pct(
            raw.actas_validadas_provincia, raw.total_mesas_provincia
        )

        return ProvinciaResultados(
            codigo_provincia=raw.codigo_provincia,
            nombre_provincia=raw.nombre_provincia,
            total_mesas_provincia=raw.total_mesas_provincia,
            actas_validadas_provincia=raw.actas_validadas_provincia,
            porcentaje_avance_provincia=porcentaje_avance,
            ganador=ganador,
            resultados_candidatos=resultados,
        )


def _pct(numerador: int, denominador: int) -> float:
    if denominador <= 0:
        return 0.0
    return round(numerador / denominador * 100, 2)
