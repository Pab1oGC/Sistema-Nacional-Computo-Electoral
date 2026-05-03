from dataclasses import dataclass

from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)
from recuento_oficial.domain.repositories.partido_repository import (
    PartidoRepository,
)


@dataclass
class CandidatoResultado:
    candidato_id: int
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    orden_papeleta: int
    votos_total: int
    porcentaje: float


@dataclass
class ResultadosOficial:
    total_votos_validos: int
    total_blancos: int
    total_nulos: int
    candidatos: list[CandidatoResultado]


class ConsultarResultadosUseCase:
    def __init__(
        self,
        acta_repo: ActaOficialRepository,
        partido_repo: PartidoRepository,
    ) -> None:
        self._actas = acta_repo
        self._partidos = partido_repo

    async def execute(self) -> ResultadosOficial:
        partidos = await self._partidos.list_all()
        votos_por_partido = await self._actas.aggregate_votos_por_partido()
        blancos = await self._actas.total_blancos()
        nulos = await self._actas.total_nulos()
        total_validos = sum(votos_por_partido.values())

        candidatos = [
            self._build_candidato(p, votos_por_partido.get(p.id_partido, 0), total_validos)
            for p in partidos
        ]
        candidatos.sort(key=lambda c: c.orden_papeleta)

        return ResultadosOficial(
            total_votos_validos=total_validos,
            total_blancos=blancos,
            total_nulos=nulos,
            candidatos=candidatos,
        )

    @staticmethod
    def _build_candidato(p: Partido, votos: int, total: int) -> CandidatoResultado:
        porcentaje = round(votos / total * 100, 2) if total else 0.0
        return CandidatoResultado(
            candidato_id=p.id_partido,
            sigla_candidato=p.sigla_candidato,
            nombre_candidato=p.nombre_candidato,
            sigla_partido=p.sigla_partido,
            color_hex=p.color_hex,
            orden_papeleta=p.orden_papeleta,
            votos_total=votos,
            porcentaje=porcentaje,
        )
