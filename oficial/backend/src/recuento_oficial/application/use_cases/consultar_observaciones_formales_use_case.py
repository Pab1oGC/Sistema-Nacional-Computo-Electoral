from dataclasses import dataclass

from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)


# Catálogo texto-humano para el dashboard. Una sola fuente de verdad.
DESCRIPCION_HUMANA: dict[str, str] = {
    "FALTA_DATOS_APERTURA_CIERRE":
        "El acta no registra la hora de apertura o cierre de la mesa.",
    "MESA_LUGAR_DISTINTO":
        "La mesa funcionó en un recinto diferente al autorizado.",
    "USO_FORMULARIOS_NO_OFICIALES":
        "Se utilizaron formularios no aprobados por el TSE.",
    "PAPELETAS_NO_AUTORIZADAS":
        "Aparecieron papeletas no autorizadas durante el conteo.",
    "AUSENCIA_DELEGADOS":
        "Faltaron delegados de partidos sin justificación.",
    "FECHA_INCORRECTA":
        "El acta consigna una fecha incorrecta.",
    "ERRORES_TRANSCRIPCION":
        "Se detectaron errores en la transcripción manual de números.",
    "FALTA_FIRMAS_HUELLAS":
        "El acta carece de las firmas o huellas requeridas.",
    "INCONSISTENCIA_ARITMETICA":
        "La suma de votos no concuerda con los totales reportados.",
}

# Orden estable usado en la respuesta. Coincide con el orden de declaración
# del enum oficial.tipo_observacion_formal en schema-v2.sql.
ORDEN_TIPOS: tuple[str, ...] = tuple(DESCRIPCION_HUMANA.keys())


@dataclass
class ConteoObservacionFormal:
    tipo: str
    cantidad: int
    descripcion_humana: str


@dataclass
class ObservacionesFormalesReport:
    total: int
    conteos_por_tipo: list[ConteoObservacionFormal]


class ConsultarObservacionesFormalesUseCase:
    """Devuelve el desglose de observaciones formales del docente sobre las
    actas oficiales.

    Garantiza que las 9 categorías del enum aparecen siempre en la
    respuesta (las sin observaciones con cantidad=0). Eso permite al
    dashboard renderizar barras consistentes sin tener que preguntar
    qué categorías existen.
    """

    def __init__(self, repo: ActaOficialRepository) -> None:
        self._repo = repo

    async def execute(self) -> ObservacionesFormalesReport:
        conteos_raw = await self._repo.contar_por_tipo_observacion_formal()
        items = [
            ConteoObservacionFormal(
                tipo=tipo,
                cantidad=conteos_raw.get(tipo, 0),
                descripcion_humana=DESCRIPCION_HUMANA[tipo],
            )
            for tipo in ORDEN_TIPOS
        ]
        total = sum(item.cantidad for item in items)
        return ObservacionesFormalesReport(
            total=total,
            conteos_por_tipo=items,
        )
