import json
import logging
import time
from datetime import datetime, timezone

from confluent_kafka import Consumer, KafkaError, KafkaException

from config import settings
from services.mongo import get_db
from services.producer import emit
from validations import (
    ESTADO_COMPUTABLE,
    ESTADO_NO_COMPUTABLE,
    validate,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [validator] %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

TOPIC_IN             = "actas.ocr"
TOPIC_COMPUTABLES    = "actas.computables_rrv"
TOPIC_NO_COMPUTABLES = "actas.no_computables_rrv"
TOPIC_ALERTAS        = "actas.alertas_legales"
TOPIC_DLQ            = "actas.dlq"
GROUP_ID             = "validator-group"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_consumer() -> Consumer:
    for attempt in range(1, 11):
        try:
            c = Consumer({
                "bootstrap.servers": settings.kafka_bootstrap,
                "group.id": GROUP_ID,
                "auto.offset.reset": "earliest",
                "enable.auto.commit": False,
                "socket.timeout.ms": 10000,
                "session.timeout.ms": 30000,
                "heartbeat.interval.ms": 5000,
            })
            c.subscribe([TOPIC_IN])
            log.info("Kafka conectado (intento %d)", attempt)
            return c
        except Exception as exc:
            log.warning("Kafka no disponible (intento %d): %s", attempt, exc)
            time.sleep(5)
    raise RuntimeError("No se pudo conectar a Kafka tras 10 intentos")


def _update_cqrs(acta: dict, resultado, db) -> None:
    ts = _now()
    votos_obj  = acta.get("votos") or {}
    candidatos = votos_obj.get("candidatos") or []

    if resultado.ok:
        for c in candidatos:
            db.vista_resultados.update_one(
                {"candidato_id": c["candidato_id"]},
                {
                    "$inc": {"votos_total": c.get("votos", 0)},
                    "$set": {"ultima_actualizacion": ts},
                },
                upsert=True,
            )

    val = resultado.validaciones
    inc: dict = {"actas_pendientes": -1}

    if resultado.ok:
        inc["total_computables_rrv"] = 1
    else:
        inc["total_no_computables_rrv"] = 1

    if resultado.observacion_detectada:
        inc["actas_con_observacion"] = 1
    if resultado.posible_nulidad_legal:
        inc["posibles_nulidades_legales"] = 1
    if val.duplicado_conflictivo:
        inc["duplicados_conflictivos"] = 1

    db.vista_actas_estado.update_one(
        {"_id": "global"},
        {
            "$inc": inc,
            "$set": {"ultima_actualizacion": ts},
        },
        upsert=True,
    )


def _process(msg_key: str, payload: dict) -> None:
    db = get_db()
    id_acta = payload.get("id_acta") or msg_key

    acta = db.actas.find_one({"id_acta": id_acta})
    if acta is None:
        log.warning("Acta %s no encontrada en MongoDB, ignorando", id_acta)
        return

    if acta.get("estado") != "OCR_COMPLETADO":
        log.info("Acta %s en estado %s, ignorando", id_acta, acta.get("estado"))
        return

    resultado = validate(acta, db)
    ts = _now()
    resultado_dict = resultado.to_dict()

    codigo_mesa    = acta.get("codigo_mesa")
    codigo_recinto = acta.get("codigo_recinto")

    if resultado.ok:
        db.actas.update_one(
            {"id_acta": id_acta},
            {
                "$set": {
                    "estado":      ESTADO_COMPUTABLE,
                    "validado_en": ts,
                    "rrv":         resultado_dict,
                },
                "$push": {
                    "eventos": {
                        "tipo":   "RrvActaComputable",
                        "ts":     ts,
                        "motivo": resultado.motivo_rrv,
                    }
                },
            },
        )
        db.eventos.insert_one({
            "tipo":           "RrvActaComputable",
            "id_acta":        id_acta,
            "codigo_mesa":    codigo_mesa,
            "codigo_recinto": codigo_recinto,
            "motivo":         resultado.motivo_rrv,
            "advertencias":   resultado.advertencias,
            "alerta_legal":   resultado.alerta_legal,
            "ts":             ts,
        })
        _update_cqrs(acta, resultado, db)
        emit(TOPIC_COMPUTABLES, id_acta, {
            "id_acta":        id_acta,
            "codigo_mesa":    codigo_mesa,
            "codigo_recinto": codigo_recinto,
            "motivo":         resultado.motivo_rrv,
            "alerta_legal":   resultado.alerta_legal,
            "ts":             ts.isoformat(),
        })

        if resultado.alerta_legal:
            _emit_alerta_legal(id_acta, codigo_mesa, codigo_recinto, resultado, ts)

        log.info("Acta %s COMPUTABLE_RRV — %s", id_acta, resultado.motivo_rrv)

    else:
        db.actas.update_one(
            {"id_acta": id_acta},
            {
                "$set": {
                    "estado":       ESTADO_NO_COMPUTABLE,
                    "rechazado_en": ts,
                    "rrv":          resultado_dict,
                },
                "$push": {
                    "eventos": {
                        "tipo":    "RrvActaNoComputable",
                        "ts":      ts,
                        "motivo":  resultado.motivo_rrv,
                        "errores": resultado.errores,
                    }
                },
            },
        )
        db.eventos.insert_one({
            "tipo":                  "RrvActaNoComputable",
            "id_acta":               id_acta,
            "codigo_mesa":           codigo_mesa,
            "codigo_recinto":        codigo_recinto,
            "motivo":                resultado.motivo_rrv,
            "errores":               resultado.errores,
            "posible_nulidad_legal": resultado.posible_nulidad_legal,
            "ts":                    ts,
        })

        for err in resultado.errores:
            db.logs_inconsistencias.insert_one({
                "id_acta":             id_acta,
                "codigo_mesa":         codigo_mesa,
                "codigo_recinto":      codigo_recinto,
                "tipo_inconsistencia": err.split(":")[0],
                "detalle":             err,
                "posible_nulidad":     resultado.posible_nulidad_legal,
                "ts":                  ts,
            })

        _update_cqrs(acta, resultado, db)
        emit(TOPIC_NO_COMPUTABLES, id_acta, {
            "id_acta":               id_acta,
            "codigo_mesa":           codigo_mesa,
            "codigo_recinto":        codigo_recinto,
            "motivo":                resultado.motivo_rrv,
            "errores":               resultado.errores,
            "posible_nulidad_legal": resultado.posible_nulidad_legal,
            "ts":                    ts.isoformat(),
        })

        if resultado.posible_nulidad_legal:
            _emit_alerta_legal(id_acta, codigo_mesa, codigo_recinto, resultado, ts)

        log.warning("Acta %s NO_COMPUTABLE_RRV — %s", id_acta, resultado.motivo_rrv)


def _emit_alerta_legal(id_acta, codigo_mesa, codigo_recinto, resultado, ts) -> None:
    emit(TOPIC_ALERTAS, id_acta, {
        "tipo":                                  "PossibleLegalNullityDetected",
        "id_acta":                               id_acta,
        "codigo_mesa":                           codigo_mesa,
        "codigo_recinto":                        codigo_recinto,
        "estado_rrv":                            resultado.estado_rrv,
        "motivo":                                resultado.motivo_rrv,
        "errores":                               resultado.errores,
        "observacion_detectada":                 resultado.observacion_detectada,
        "observacion_fuera_recuadro":            resultado.observacion_fuera_recuadro,
        "observacion_afecta_campos_obligatorios": resultado.observacion_afecta_campos_obligatorios,
        "ts": ts.isoformat(),
    })
    log.warning("Alerta legal emitida para acta %s (estado=%s)", id_acta, resultado.estado_rrv)


def main() -> None:
    consumer = _make_consumer()
    log.info("Esperando mensajes en %s ...", TOPIC_IN)

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                raise KafkaException(msg.error())

            key     = msg.key().decode("utf-8") if msg.key() else ""
            payload = json.loads(msg.value().decode("utf-8"))
            log.info("Procesando acta %s (offset=%d)", key, msg.offset())

            try:
                _process(key, payload)
                consumer.commit(asynchronous=False)
            except Exception as exc:
                log.error("Error procesando acta %s: %s", key, exc, exc_info=True)
                try:
                    emit(TOPIC_DLQ, key, {"id_acta": key, "error": str(exc), "origin": TOPIC_IN})
                except Exception:
                    pass
                consumer.commit(asynchronous=False)
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
