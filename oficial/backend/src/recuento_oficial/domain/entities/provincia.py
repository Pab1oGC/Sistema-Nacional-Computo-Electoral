from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Provincia:
    """Provincia boliviana.

    Bolivia tiene 112 provincias agrupadas dentro de los 9 departamentos.
    Cada provincia agrupa N municipios (340 municipios en total).
    """

    codigo: str
    nombre: str
    codigo_departamento: int
