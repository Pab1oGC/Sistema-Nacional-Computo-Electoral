import json
import logging
import time
from datetime import datetime, timezone

from kafka import KafkaConsumer
from pymongo import ReturnDocument

from config import settings
from services.mongo import get_db
from services.producer import emit
from validations import validate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [validator] %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

TOPIC_IN = "actas.ocr"
TOPIC_VALIDADAS = "actas.validadas"
TOPIC_RECHAZADAS = "actas.rechazadas"
TOPIC_DLQ = "actas.dlq"
GROUP_ID = "validator-group"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_consumer() -> KafkaConsumer:
    for attempt in range(1, 11):
        try:
            consumer = KafkaConsumer(
                TOPIC_IN,
                bootstrap_servers=[settings.kafka_bootstrap],
                group_id=GROUP_ID,
                value_deserializer=lambda b: json.loads(b.decode("utf-8")),
                key_deserializer=lambda b: b.decode("utf-8") if b else None,
                auto_offset_reset="earliest",
                enable_auto_commit=False,
            )
            log.info("Kafka conectado (intento %d)", attempt)
            return consumer
        except Exception as exc:
            log.warning("Kafka no disponible (intento %d): %s", attempt, exc)
            time.sleep(5)
    raise RuntimeError("No se pudo conectar a Kafka tras 10 intentos")


def _update_cqrs(acta: dict, db) -> None:
    """Actualiza las vistas de lectura (CQRS) tras validar un acta."""
    ts = _now()
    votos_obj = acta.get("votos") or {}
    candidatos = votos_obj.get("candidatos") or []

    # vista_resultados: un documento por candidato_id
    for c in candidatos:
        db.vista_resultados.update_one(
            {"candidato_id": c["candidato_id"]},
            {
                "$inc": {"votos_total": c["votos"]},
                "$set": {"ultima_actualizacion": ts},
            },
        )

    # vista_actas_estado: documento único con _id "global"
    inc = {
        "actas_validadas": 1,
        "actas_pendientes": -1,
    }
    db.vista_actas_estado.update_one(
        {"_id": "global"},
        {
            "$inc": inc,
            "$set": {"ultima_actualizacion": ts},
        },
    )


def _process(msg_key: str, payload: dict) -> None:
    db = get_db()
    id_acta = payload.get("id_acta") or msg_key

    # Idempotencia: solo procesar actas en estado OCR_COMPLETADO
    acta = db.actas.find_one({"id_acta": id_acta})
    if acta is None:
        log.warning("Acta %s no encontrada en MongoDB, ignorando", id_acta)
        return

    if acta.get("estado") != "OCR_COMPLETADO":
        log.info("Acta %s en estado %s, ignorando", id_acta, acta.get("estado"))
        return

    resultado = validate(acta, db)
    ts = _now()

    if resultado.ok:
        # ── VALIDADA ────────────────────────────────────────────────────
        db.actas.update_one(
            {"id_acta": id_acta},
            {
                "$set": {"estado": "VALIDADA", "validado_en": ts},
                "$push": {
                    "eventos": {
                        "tipo": "ActaValidada",
                        "ts": ts,
                    }
                },
            },
        )
        db.eventos.insert_one(
            {
                "tipo": "ActaValidada",
                "id_acta": id_acta,
                "codigo_mesa": acta["codigo_mesa"],
                "ts": ts,
            }
        )
        _update_cqrs(acta, db)
        emit(TOPIC_VALIDADAS, id_acta, {"id_acta": id_acta, "codigo_mesa": acta["codigo_mesa"], "ts": ts.isoformat()})
        log.info("✔ Acta %s VALIDADA", id_acta)

    else:
        # ── RECHAZADA ───────────────────────────────────────────────────
        db.actas.update_one(
            {"id_acta": id_acta},
            {
                "$set": {"estado": "RECHAZADA", "rechazado_en": ts, "errores_validacion": resultado.errores},
                "$push": {
                    "eventos": {
                        "tipo": "ActaRechazada",
                        "ts": ts,
                        "errores": resultado.errores,
                    }
                },
            },
        )
        db.eventos.insert_one(
            {
                "tipo": "ActaRechazada",
                "id_acta": id_acta,
                "codigo_mesa": acta["codigo_mesa"],
                "errores": resultado.errores,
                "ts": ts,
            }
        )
        for err in resultado.errores:
            db.logs_inconsistencias.insert_one(
                {
                    "id_acta": id_acta,
                    "codigo_mesa": acta["codigo_mesa"],
                    "tipo_inconsistencia": err.split(":")[0],
                    "detalle": err,
                    "ts": ts,
                }
            )
        db.vista_actas_estado.update_one(
            {"_id": "global"},
            {
                "$inc": {"actas_rechazadas": 1, "actas_pendientes": -1},
                "$set": {"ultima_actualizacion": ts},
            },
        )
        emit(TOPIC_RECHAZADAS, id_acta, {"id_acta": id_acta, "errores": resultado.errores, "ts": ts.isoformat()})
        log.warning("✘ Acta %s RECHAZADA: %s", id_acta, resultado.errores)


def main() -> None:
    consumer = _make_consumer()
    log.info("Esperando mensajes en %s ...", TOPIC_IN)

    for msg in consumer:
        key: str = msg.key or ""
        payload: dict = msg.value or {}
        log.info("Procesando acta %s (offset=%d)", key, msg.offset)

        try:
            _process(key, payload)
            consumer.commit()
        except Exception as exc:
            log.error("Error procesando acta %s: %s", key, exc, exc_info=True)
            try:
                emit(
                    TOPIC_DLQ,
                    key,
                    {"id_acta": key, "error": str(exc), "origin": TOPIC_IN},
                )
            except Exception:
                pass
            consumer.commit()


if __name__ == "__main__":
    main()
