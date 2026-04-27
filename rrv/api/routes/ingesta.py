import hashlib
import hmac
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from config import settings
from models.acta import EstadoActa, SMSPayload, TipoEntrada
from services.mongo import get_db
from services.producer import emit
from services.storage import upload_acta

router = APIRouter(prefix="/api/v1/actas", tags=["ingesta"])

# RRV|<mesa>|<ts14>|<c1>:<v1>,...|N:<nulos>,B:<blancos>|<hmac_hex>
_SMS_RE = re.compile(
    r"^RRV\|(\d+)\|(\d{14})\|([^|]+)\|N:(\d+),B:(\d+)\|([a-f0-9]{64})$"
)


def _sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _object_name(codigo_mesa: int, id_acta: str, ext: str) -> str:
    now = datetime.now(timezone.utc)
    digest = id_acta.split(":")[-1][:16]
    return f"{now.year}/{now.month:02d}/{now.day:02d}/{codigo_mesa}/{digest}.{ext}"


def _already_exists(id_acta: str) -> bool:
    return get_db().actas.find_one({"id_acta": id_acta}, {"_id": 1}) is not None


def _save_evento(db, evento: dict, ts: datetime) -> None:
    db.eventos.insert_one({**evento, "timestamp": ts})


def _inc_recibidas(db) -> None:
    db.vista_actas_estado.update_one(
        {"_id": "global"},
        {"$inc": {"actas_recibidas": 1}},
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/actas/foto
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/foto", status_code=202)
async def recibir_foto(
    file: UploadFile = File(...),
    codigo_mesa: int = Form(...),
    codigo_recinto: int = Form(...),
    codigo_distribucion_territorial: str = Form(...),
):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Archivo vacío")

    id_acta = _sha256(content)
    db = get_db()

    # Idempotencia: si el hash ya existe, registrar y responder sin reprocesar
    if _already_exists(id_acta):
        db.logs_inconsistencias.insert_one({
            "id_acta": id_acta,
            "codigo_mesa": codigo_mesa,
            "tipo": "DUPLICADO",
            "descripcion": f"Foto duplicada para mesa {codigo_mesa}",
            "valores_recibidos": {"filename": file.filename},
            "timestamp": datetime.now(timezone.utc),
            "resuelto": False,
        })
        return JSONResponse(
            status_code=200,
            content={"id_acta": id_acta, "already_processed": True,
                     "mensaje": "Acta ya procesada anteriormente"},
        )

    # Subir imagen/PDF a MinIO
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower()
    path = upload_acta(content, _object_name(codigo_mesa, id_acta, ext),
                       file.content_type or "application/octet-stream")

    now = datetime.now(timezone.utc)

    # Persistir en MongoDB
    db.actas.insert_one({
        "id_acta": id_acta,
        "codigo_mesa": codigo_mesa,
        "codigo_recinto": codigo_recinto,
        "codigo_distribucion_territorial": codigo_distribucion_territorial,
        "tipo_entrada": TipoEntrada.FOTO,
        "estado": EstadoActa.RECIBIDA,
        "archivo_imagen_path": path,
        "hash_imagen": id_acta,
        "timestamp_recepcion": now,
        "timestamp_procesado": None,
        "inconsistencias": [],
        "fuente": TipoEntrada.FOTO,
    })

    # Emitir evento al pipeline
    evento = {
        "id_evento": str(uuid.uuid4()),
        "tipo": "ActaRecibida",
        "id_acta": id_acta,
        "codigo_mesa": codigo_mesa,
        "payload": {
            "tipo_entrada": "FOTO",
            "archivo_path": path,
            "hash_imagen": id_acta,
            "timestamp_recepcion": now.isoformat(),
        },
        "timestamp": now.isoformat(),
        "version": 1,
    }
    emit("actas.recibidas", key=str(codigo_mesa), payload=evento)
    _save_evento(db, evento, now)
    _inc_recibidas(db)

    return {"id_acta": id_acta, "estado": EstadoActa.RECIBIDA,
            "mensaje": "Acta recibida y encolada para OCR"}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/actas/sms
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/sms", status_code=202)
def recibir_sms(payload: SMSPayload):
    body = payload.body.strip()
    m = _SMS_RE.match(body)
    if not m:
        raise HTTPException(
            400,
            "Formato inválido. Esperado: RRV|<mesa>|<ts14>|<c1>:<v1>,...|N:<nulos>,B:<blancos>|<hmac>",
        )

    codigo_mesa   = int(m.group(1))
    timestamp_str = m.group(2)
    votos_raw     = m.group(3)
    nulos         = int(m.group(4))
    blancos       = int(m.group(5))
    recv_hmac     = m.group(6)

    # Verificar HMAC-SHA256 — anti-suplantación
    message = f"RRV|{codigo_mesa}|{timestamp_str}|{votos_raw}|N:{nulos},B:{blancos}"
    expected = hmac.new(
        settings.sms_secret_key.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, recv_hmac):
        raise HTTPException(403, "HMAC inválido — posible suplantación")

    # Parsear votos "1:120,2:80,3:45,4:15"
    try:
        candidatos = [
            {"candidato_id": int(p.split(":")[0]), "votos": int(p.split(":")[1])}
            for p in votos_raw.split(",")
        ]
    except (ValueError, IndexError):
        raise HTTPException(400, "Formato de votos inválido")

    votos_validos = sum(c["votos"] for c in candidatos)
    id_acta = _sha256(message.encode())
    db = get_db()

    if _already_exists(id_acta):
        return JSONResponse(
            status_code=200,
            content={"id_acta": id_acta, "already_processed": True,
                     "mensaje": "SMS ya procesado anteriormente"},
        )

    now = datetime.now(timezone.utc)

    db.actas.insert_one({
        "id_acta": id_acta,
        "codigo_mesa": codigo_mesa,
        "tipo_entrada": TipoEntrada.SMS,
        "estado": EstadoActa.RECIBIDA,
        "votos": {
            "candidatos": candidatos,
            "validos": votos_validos,
            "blancos": blancos,
            "nulos": nulos,
        },
        "archivo_imagen_path": "",
        "hash_imagen": id_acta,
        "timestamp_recepcion": now,
        "timestamp_procesado": None,
        "inconsistencias": [],
        "fuente": TipoEntrada.SMS,
    })

    evento = {
        "id_evento": str(uuid.uuid4()),
        "tipo": "ActaSMSRecibida",
        "id_acta": id_acta,
        "codigo_mesa": codigo_mesa,
        "payload": {
            "tipo_entrada": "SMS",
            "from_number": payload.from_number,
            "votos": candidatos,
            "validos": votos_validos,
            "nulos": nulos,
            "blancos": blancos,
            "timestamp_recepcion": now.isoformat(),
        },
        "timestamp": now.isoformat(),
        "version": 1,
    }
    emit("actas.recibidas", key=str(codigo_mesa), payload=evento)
    _save_evento(db, evento, now)
    _inc_recibidas(db)

    return {"id_acta": id_acta, "estado": EstadoActa.RECIBIDA,
            "mensaje": "SMS recibido y encolado"}
