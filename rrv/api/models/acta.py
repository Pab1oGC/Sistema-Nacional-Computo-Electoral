from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class TipoEntrada(str, Enum):
    FOTO = "FOTO"
    SMS = "SMS"


class EstadoActa(str, Enum):
    RECIBIDA = "RECIBIDA"
    OCR_PROCESANDO = "OCR_PROCESANDO"
    VALIDADA = "VALIDADA"
    RECHAZADA = "RECHAZADA"
    DUPLICADA = "DUPLICADA"


class ActaResponse(BaseModel):
    id_acta: str
    estado: EstadoActa
    mensaje: str
    already_processed: bool = False


class SMSPayload(BaseModel):
    from_number: str
    body: str  # Formato: RRV|<mesa>|<ts14>|<c1>:<v1>,...|N:<nulos>,B:<blancos>|<hmac>
