from dataclasses import dataclass
from datetime import datetime, timezone

from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)

TOTAL_MESAS_UNIVERSO = 5396  # ver oficial/CLAUDE.md sec 8


@dataclass
class AvanceOficial:
    total_mesas: int
    actas_validadas: int
    actas_pendientes: int
    porcentaje_avance: float
    ultima_actualizacion: datetime


class ConsultarAvanceUseCase:
    def __init__(self, repo: ActaOficialRepository) -> None:
        self._repo = repo

    async def execute(self) -> AvanceOficial:
        validadas = await self._repo.count_actas_validadas()
        total = TOTAL_MESAS_UNIVERSO
        pendientes = max(0, total - validadas)
        porcentaje = round(validadas / total * 100, 2) if total else 0.0
        return AvanceOficial(
            total_mesas=total,
            actas_validadas=validadas,
            actas_pendientes=pendientes,
            porcentaje_avance=porcentaje,
            ultima_actualizacion=datetime.now(timezone.utc),
        )
