from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)


class RegistrarRecuentoRequest(BaseModel):
    codigo_acta: str = Field(min_length=13, max_length=13, pattern=r"^\d{13}$")
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
    apertura_hora: int | None = Field(default=None, ge=0, le=23)
    apertura_minutos: int | None = Field(default=None, ge=0, le=59)
    cierre_hora: int | None = Field(default=None, ge=0, le=23)
    cierre_minutos: int | None = Field(default=None, ge=0, le=59)

    def to_dto(self) -> RegistrarRecuentoDTO:
        return RegistrarRecuentoDTO(**self.model_dump())


class ActaOficialResponse(BaseModel):
    """Respuesta del endpoint POST /recuento y GET /actas/{codigo}.

    Campo `tipo` siempre vale "FORM" para diferenciar de las actas del RRV
    que tienen tipo "FOTO" o "SMS". Esto permite al dashboard general
    mostrar TREP vs Oficial sin transformación.
    """

    model_config = ConfigDict(from_attributes=True)

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
    fecha_creacion: datetime
    tipo: str = "FORM"


class ListaActasResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: list[ActaOficialResponse]
