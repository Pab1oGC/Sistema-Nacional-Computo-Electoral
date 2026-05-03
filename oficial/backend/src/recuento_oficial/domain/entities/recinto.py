from dataclasses import dataclass


@dataclass
class Recinto:
    codigo_recinto: int
    nombre: str
    direccion: str
    codigo_municipio: str
