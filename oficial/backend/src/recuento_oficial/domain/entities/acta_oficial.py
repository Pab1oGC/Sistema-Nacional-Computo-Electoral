from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class ActaOficial:
    """Acta oficial transcripta por el sistema oficial.

    Fuente de verdad legal del recuento. Persiste en PostgreSQL con
    replicación síncrona (RPO=0).
    """

    id_acta: str
    codigo_acta: str
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
    apertura_hora: int | None = None
    apertura_minutos: int | None = None
    cierre_hora: int | None = None
    cierre_minutos: int | None = None
    fecha_creacion: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def votos_por_partidos(self) -> int:
        return self.votos_p1 + self.votos_p2 + self.votos_p3 + self.votos_p4

    @property
    def total_votos(self) -> int:
        return self.votos_por_partidos + self.blancos + self.nulos
