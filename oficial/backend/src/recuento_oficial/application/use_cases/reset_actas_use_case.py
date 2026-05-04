from dataclasses import dataclass
from datetime import datetime, timezone

from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)
from recuento_oficial.domain.repositories.actas_descartadas_repository import (
    ActasDescartadasRepository,
)
from recuento_oficial.domain.repositories.inconsistencia_repository import (
    InconsistenciaRepository,
)


@dataclass
class ResetActasReport:
    rows_truncated: dict[str, int]
    timestamp: datetime


class ResetActasUseCase:
    """Borra todas las filas de las tablas operativas (acta_oficial,
    log_inconsistencias, actas_descartadas) y devuelve cuántas filas
    había antes del truncate.

    Pensado para que n8n alterne perfiles de carga en la demo sin que
    se acumulen registros entre corridas. NO toca catálogos
    (departamento, provincia, municipio, recinto, mesa, partido).

    El gating del endpoint vive en el router (variable de entorno y
    confirmation token). El use case asume que ya está autorizado a
    correr.
    """

    def __init__(
        self,
        acta_repo: ActaOficialRepository,
        inconsistencia_repo: InconsistenciaRepository,
        descartada_repo: ActasDescartadasRepository,
    ) -> None:
        self._actas = acta_repo
        self._inconsistencias = inconsistencia_repo
        self._descartadas = descartada_repo

    async def execute(self) -> ResetActasReport:
        actas = await self._actas.count_all()
        incons = await self._inconsistencias.count_all()
        descart = await self._descartadas.count_all()

        # Orden defensivo: actas primero. log_inconsistencias y
        # actas_descartadas no tienen FK contra acta_oficial, así que el
        # orden es indiferente, pero respetamos el natural.
        await self._actas.truncate_all()
        await self._inconsistencias.truncate_all()
        await self._descartadas.truncate_all()

        return ResetActasReport(
            rows_truncated={
                "acta_oficial": actas,
                "log_inconsistencias": incons,
                "actas_descartadas": descart,
            },
            timestamp=datetime.now(timezone.utc),
        )
