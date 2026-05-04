from dataclasses import dataclass

from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
    ResultadoDepto,
)
from recuento_oficial.domain.repositories.partido_repository import (
    PartidoRepository,
)


@dataclass
class CandidatoVotosDepto:
    sigla_candidato: str
    votos: int
    porcentaje: float


@dataclass
class GanadorDepto:
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    votos: int
    porcentaje: float


@dataclass
class DepartamentoResultados:
    id_departamento: int
    nombre_departamento: str
    total_mesas_depto: int
    actas_validadas_depto: int
    porcentaje_avance_depto: float
    ganador: GanadorDepto | None
    resultados_candidatos: list[CandidatoVotosDepto]


@dataclass
class ResultadosPorDepartamento:
    departamentos: list[DepartamentoResultados]


class ConsultarResultadosPorDepartamentoUseCase:
    """Compone los agregados por departamento (raw del repo) con el
    catálogo de partidos para producir un DTO listo para el dashboard.

    Decisión: si un departamento no tiene actas validadas (votos totales
    = 0), `ganador` es None. El frontend muestra "esperando reporte" en
    lugar de un ganador con 0 votos.
    """

    def __init__(
        self,
        acta_repo: ActaOficialRepository,
        partido_repo: PartidoRepository,
    ) -> None:
        self._actas = acta_repo
        self._partidos = partido_repo

    async def execute(self) -> ResultadosPorDepartamento:
        partidos = await self._partidos.list_all()
        partidos.sort(key=lambda p: p.orden_papeleta)
        agregados = await self._actas.aggregate_resultados_por_departamento()

        departamentos = [
            self._build_depto(raw, partidos) for raw in agregados
        ]
        return ResultadosPorDepartamento(departamentos=departamentos)

    @staticmethod
    def _build_depto(
        raw: ResultadoDepto, partidos: list[Partido]
    ) -> DepartamentoResultados:
        votos_por_id = {
            1: raw.votos_p1,
            2: raw.votos_p2,
            3: raw.votos_p3,
            4: raw.votos_p4,
        }
        total_validos = sum(votos_por_id.values())

        # Resultados por candidato (siempre los 4, en orden de papeleta)
        resultados = [
            CandidatoVotosDepto(
                sigla_candidato=p.sigla_candidato,
                votos=votos_por_id.get(p.id_partido, 0),
                porcentaje=_pct(votos_por_id.get(p.id_partido, 0), total_validos),
            )
            for p in partidos
        ]

        # Ganador: el partido con más votos. None si no hay votos aún.
        ganador: GanadorDepto | None = None
        if total_validos > 0:
            top = max(partidos, key=lambda p: votos_por_id.get(p.id_partido, 0))
            top_votos = votos_por_id.get(top.id_partido, 0)
            ganador = GanadorDepto(
                sigla_candidato=top.sigla_candidato,
                nombre_candidato=top.nombre_candidato,
                sigla_partido=top.sigla_partido,
                color_hex=top.color_hex,
                votos=top_votos,
                porcentaje=_pct(top_votos, total_validos),
            )

        porcentaje_avance = _pct(
            raw.actas_validadas_depto, raw.total_mesas_depto
        )

        return DepartamentoResultados(
            id_departamento=raw.id_departamento,
            nombre_departamento=raw.nombre_departamento,
            total_mesas_depto=raw.total_mesas_depto,
            actas_validadas_depto=raw.actas_validadas_depto,
            porcentaje_avance_depto=porcentaje_avance,
            ganador=ganador,
            resultados_candidatos=resultados,
        )


def _pct(numerador: int, denominador: int) -> float:
    if denominador <= 0:
        return 0.0
    return round(numerador / denominador * 100, 2)
