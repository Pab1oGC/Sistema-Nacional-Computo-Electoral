from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Municipio:
    """Municipio boliviano.

    Schema v2: el FK ahora es a provincia (no a departamento). Para llegar
    al departamento se hace JOIN provincia → municipio.
    """

    codigo: str
    nombre: str
    codigo_provincia: str
