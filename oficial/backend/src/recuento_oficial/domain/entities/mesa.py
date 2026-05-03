from dataclasses import dataclass


@dataclass
class Mesa:
    codigo_mesa: int
    nro_mesa: int
    cantidad_habilitada: int
    codigo_recinto: int
