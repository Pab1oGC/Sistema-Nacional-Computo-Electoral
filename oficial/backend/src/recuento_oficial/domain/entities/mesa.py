from dataclasses import dataclass


@dataclass
class Mesa:
    codigo_mesa: int
    nro_mesa: int
    votantes_habilitados: int
    codigo_recinto: int
