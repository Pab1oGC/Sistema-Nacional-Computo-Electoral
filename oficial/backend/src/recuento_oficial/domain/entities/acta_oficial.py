from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class ActaOficial:
    """Acta oficial transcripta por el sistema oficial.

    Fuente de verdad legal del recuento. Persiste en PostgreSQL con
    replicación síncrona (RPO=0).

    Schema v2:
    - id_acta es BIGSERIAL: None antes del INSERT, BD lo asigna.
    - codigo_acta es BIGINT (13 dígitos numéricos).
    - codigo_mesa es BIGINT (13 dígitos numéricos).
    - Campos apertura_hora/cierre_hora removidos del schema.
    - observacion_formal + tipo_observacion_formal son nuevos.
    - fecha_creacion → fecha_procesado.
    """

    codigo_acta: int
    codigo_mesa: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int
    blancos: int
    nulos: int
    habilitados: int
    anfora: int
    no_usadas: int
    id_acta: int | None = None
    observacion_formal: str | None = None
    tipo_observacion_formal: str | None = None
    fecha_procesado: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def votos_por_partidos(self) -> int:
        return self.votos_p1 + self.votos_p2 + self.votos_p3 + self.votos_p4

    @property
    def total_votos(self) -> int:
        return self.votos_por_partidos + self.blancos + self.nulos
