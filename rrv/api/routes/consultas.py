from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId

from services.mongo import get_db

router = APIRouter(prefix="/api/v1", tags=["consultas"])


def _clean(doc: dict) -> dict:
    """Convierte ObjectId a str para serialización JSON."""
    doc["_id"] = str(doc["_id"]) if "_id" in doc else None
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/resultados
# Vista CQRS: votos acumulados por candidato
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/resultados")
def get_resultados():
    db = get_db()

    # Unir vista_resultados con candidatos para devolver nombre y partido
    pipeline = [
        {"$sort": {"candidato_id": 1}},
        {
            "$lookup": {
                "from": "candidatos",
                "localField": "candidato_id",
                "foreignField": "id",
                "as": "info",
            }
        },
        {"$unwind": {"path": "$info", "preserveNullAndEmptyArrays": True}},
        {
            "$project": {
                "_id": 0,
                "candidato_id": 1,
                "nombre":   {"$ifNull": ["$info.nombre",  "Desconocido"]},
                "partido":  {"$ifNull": ["$info.partido", ""]},
                "sigla":    {"$ifNull": ["$info.sigla",   ""]},
                "color":    {"$ifNull": ["$info.color",   "#999999"]},
                "votos_total": 1,
                "ultima_actualizacion": 1,
            }
        },
    ]

    resultados = list(db.vista_resultados.aggregate(pipeline))

    total_votos = sum(r.get("votos_total", 0) for r in resultados)
    for r in resultados:
        v = r.get("votos_total", 0)
        r["porcentaje"] = round(v / total_votos * 100, 2) if total_votos else 0.0

    return {"total_votos_validos": total_votos, "candidatos": resultados}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/avance
# Vista CQRS: progreso del escrutinio (mesas reportadas vs total)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/avance")
def get_avance():
    db = get_db()
    doc = db.vista_actas_estado.find_one({"_id": "global"})
    if not doc:
        raise HTTPException(status_code=503, detail="Vista de avance no inicializada")

    total = doc.get("total_mesas", 35000)
    validadas = doc.get("actas_validadas", 0)
    doc["porcentaje_avance"] = round(validadas / total * 100, 2) if total else 0.0
    doc.pop("_id", None)
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/actas
# Lista paginada de actas con filtros opcionales
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/actas")
def list_actas(
    estado: Optional[str] = Query(None, description="RECIBIDA|OCR_PROCESANDO|VALIDADA|RECHAZADA"),
    codigo_mesa: Optional[int] = Query(None),
    territorial: Optional[str] = Query(None, description="Código territorial ej. 70101"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    filtro: dict = {}
    if estado:
        filtro["estado"] = estado.upper()
    if codigo_mesa is not None:
        filtro["codigo_mesa"] = codigo_mesa
    if territorial:
        filtro["codigo_distribucion_territorial"] = territorial

    skip = (page - 1) * limit
    total = db.actas.count_documents(filtro)
    docs = list(
        db.actas.find(
            filtro,
            {
                "id_acta": 1, "codigo_mesa": 1, "tipo_entrada": 1,
                "estado": 1, "timestamp_recepcion": 1,
                "votos": 1, "requiere_revision": 1,
                "codigo_distribucion_territorial": 1,
            },
        )
        .sort("timestamp_recepcion", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [_clean(d) for d in docs],
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/actas/{id_acta}
# Detalle completo de un acta
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/actas/{id_acta}")
def get_acta(id_acta: str):
    db = get_db()
    doc = db.actas.find_one({"id_acta": id_acta}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Acta no encontrada")
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/mesas/{codigo_mesa}/acta
# Acta asociada a una mesa específica
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/mesas/{codigo_mesa}/acta")
def get_acta_by_mesa(codigo_mesa: int):
    db = get_db()
    # Preferir la validada; si no, la más reciente
    doc = db.actas.find_one(
        {"codigo_mesa": codigo_mesa, "estado": "VALIDADA"},
        {"_id": 0},
    )
    if not doc:
        doc = db.actas.find_one(
            {"codigo_mesa": codigo_mesa},
            {"_id": 0},
            sort=[("timestamp_recepcion", -1)],
        )
    if not doc:
        raise HTTPException(status_code=404, detail="No hay acta para esta mesa")
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/inconsistencias
# Registro de actas rechazadas con motivo
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/inconsistencias")
def list_inconsistencias(
    tipo: Optional[str] = Query(None),
    codigo_mesa: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    db = get_db()
    filtro: dict = {}
    if tipo:
        filtro["tipo_inconsistencia"] = tipo.upper()
    if codigo_mesa is not None:
        filtro["codigo_mesa"] = codigo_mesa

    skip = (page - 1) * limit
    total = db.logs_inconsistencias.count_documents(filtro)
    docs = list(
        db.logs_inconsistencias.find(filtro, {"_id": 0})
        .sort("ts", -1)
        .skip(skip)
        .limit(limit)
    )

    return {"total": total, "page": page, "limit": limit, "items": docs}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/candidatos
# Lista de candidatos del seed (útil para el dashboard)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/candidatos")
def list_candidatos():
    db = get_db()
    docs = list(db.candidatos.find({}, {"_id": 0}).sort("id", 1))
    return {"candidatos": docs}
