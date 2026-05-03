from dataclasses import dataclass


@dataclass
class Partido:
    """Candidato/partido del recuento.

    Catálogo de 4 elementos (P1-P4) sembrado al inicializar la BD.
    Colores y siglas alineados con el seed del team lider para que el
    dashboard renderice los mismos colores en TREP y Oficial.
    """

    id_partido: int
    sigla_candidato: str
    nombre_candidato: str
    sigla_partido: str
    color_hex: str
    orden_papeleta: int
