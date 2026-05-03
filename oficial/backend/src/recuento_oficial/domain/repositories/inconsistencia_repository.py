from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol


@dataclass
class Inconsistencia:
    """Registro de un Error1 o Error2 detectado al validar un acta.

    Persiste en `oficial.log_inconsistencias` para audit trail y para servir
    la consulta 20 del enunciado del docente: "error más común en
    verificación".
    """

    codigo_acta: str
    codigo_mesa: int
    tipo: str  # "ERROR1" | "ERROR2" | "ERROR3" | "ERROR4"
    mensaje: str
    valores_recibidos: dict[str, int | str]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    resuelto: bool = False
    id_inconsistencia: int | None = None


class InconsistenciaRepository(Protocol):
    async def save(self, inc: Inconsistencia) -> None: ...

    async def commit_pendiente(self) -> None:
        """Commit explícito de las inconsistencias guardadas con `save`.

        Este método es una excepción consciente al patrón Unit of Work:
        normalmente la gestión transaccional vive solo en `get_session()`
        del shared. Pero el audit trail de inconsistencias DEBE persistir
        incluso cuando la request termina con error (404, 422), porque
        en un sistema oficial "rejection without audit" es inaceptable.

        El trade-off: ligera ruptura del patrón a cambio de garantía
        audit-completa. Aceptable en este caso por el dominio (datos
        electorales legalmente vinculantes).
        """
        ...

    async def list(
        self,
        tipo: str | None = None,
        codigo_mesa: int | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> list[Inconsistencia]: ...

    async def count(
        self,
        tipo: str | None = None,
        codigo_mesa: int | None = None,
    ) -> int: ...

    async def tipo_mas_comun(self) -> str | None: ...
