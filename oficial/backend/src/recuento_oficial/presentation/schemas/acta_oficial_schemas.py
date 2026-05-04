from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)

# Las 9 categorías del enum oficial.tipo_observacion_formal del schema v2.
TipoObservacionFormal = Literal[
    "FALTA_DATOS_APERTURA_CIERRE",
    "MESA_LUGAR_DISTINTO",
    "USO_FORMULARIOS_NO_OFICIALES",
    "PAPELETAS_NO_AUTORIZADAS",
    "AUSENCIA_DELEGADOS",
    "FECHA_INCORRECTA",
    "ERRORES_TRANSCRIPCION",
    "FALTA_FIRMAS_HUELLAS",
    "INCONSISTENCIA_ARITMETICA",
]


class RegistrarRecuentoRequest(BaseModel):
    """Request del endpoint POST /api/v1/oficial/recuento.

    codigo_acta acepta string numérico de 13 dígitos (legacy de n8n) o int.
    Pydantic 2 hace coerción automática str→int si los chars son dígitos.
    """

    codigo_acta: int = Field(ge=10**12, le=10**13 - 1)  # 13 dígitos exactos
    codigo_mesa: int = Field(gt=0)
    votos_p1: int = Field(ge=0)
    votos_p2: int = Field(ge=0)
    votos_p3: int = Field(ge=0)
    votos_p4: int = Field(ge=0)
    blancos: int = Field(ge=0)
    nulos: int = Field(ge=0)
    habilitados: int = Field(gt=0)
    anfora: int = Field(ge=0)
    no_usadas: int = Field(ge=0)
    observacion_formal: str | None = Field(default=None, max_length=2000)
    tipo_observacion_formal: TipoObservacionFormal | None = None

    def to_dto(self) -> RegistrarRecuentoDTO:
        return RegistrarRecuentoDTO(**self.model_dump())


class ActaOficialResponse(BaseModel):
    """Respuesta del endpoint POST /recuento y GET /actas/{codigo}.

    Campo `tipo` siempre vale "FORM" para diferenciar de las actas del RRV
    que tienen tipo "FOTO" o "SMS". Esto permite al dashboard general
    mostrar TREP vs Oficial sin transformación.
    """

    model_config = ConfigDict(from_attributes=True)

    id_acta: int | None
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
    observacion_formal: str | None = None
    tipo_observacion_formal: TipoObservacionFormal | None = None
    fecha_procesado: datetime
    tipo: str = "FORM"


class ListaActasResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: list[ActaOficialResponse]
