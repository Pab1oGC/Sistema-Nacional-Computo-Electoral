import json
import logging
import time
import uuid
from datetime import datetime, timezone

from confluent_kafka import Consumer, KafkaError, KafkaException

from config import settings
from pipeline.downloader import download_file
from pipeline.preprocessor import preprocess
from pipeline.ocr import run_ocr
from pipeline.parser import parse_acta
from services.mongo import get_db
from services.producer import emit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ocr-worker")

TOPIC_IN  = "actas.recibidas"
TOPIC_OUT = "actas.ocr"
TOPIC_DLQ = "actas.dlq"
GROUP_ID  = "ocr-worker-group"


def _get_consumer() -> Consumer:
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
            logger.info("Conectado a Kafka en %s", settings.kafka_bootstrap)
            return c
        except Exception as exc:
            logger.warning("Kafka no disponible, reintento %d/10: %s", attempt, exc)
            time.sleep(5)
    raise RuntimeError("No se pudo conectar a Kafka despues de 10 intentos")


def _process(event: dict) -> None:
    id_acta     = event["id_acta"]
    codigo_mesa = event["codigo_mesa"]
    tipo        = event["payload"].get("tipo_entrada", "FOTO")
    db          = get_db()

    acta = db.actas.find_one({"id_acta": id_acta}, {"estado": 1})
    if acta and acta.get("estado") not in ("RECIBIDA",):
        logger.info("Acta %s ya procesada (estado=%s), saltando", id_acta[:16], acta.get("estado"))
        return

    db.actas.update_one({"id_acta": id_acta}, {"$set": {"estado": "OCR_PROCESANDO"}})
    db.vista_actas_estado.update_one({"_id": "global"}, {"$inc": {"actas_procesando": 1}})

    if tipo == "SMS":
        resultado = {
            "id_acta":           id_acta,
            "codigo_mesa":       codigo_mesa,
            "tipo_entrada":      "SMS",
            "votos_extraidos":   event["payload"].get("votos", []),
            "validos":           event["payload"].get("validos", 0),
            "blancos":           event["payload"].get("blancos", 0),
            "nulos":             event["payload"].get("nulos", 0),
            "confianza_ocr":     1.0,
            "requiere_revision": False,
        }
    else:
        archivo_path = event["payload"]["archivo_path"]
        bucket, object_name = archivo_path.split("/", 1)
        file_bytes = download_file(bucket, object_name)
        img_array  = preprocess(file_bytes, object_name)
        blocks     = run_ocr(img_array)
        resultado  = parse_acta(blocks, id_acta, codigo_mesa)

    update: dict = {}
    if resultado.get("votos_extraidos"):
        update["votos"] = {
            "candidatos": resultado["votos_extraidos"],
            "validos":    resultado.get("validos") or 0,
            "blancos":    resultado.get("blancos") or 0,
            "nulos":      resultado.get("nulos")   or 0,
        }
    if resultado.get("hora_apertura"):
        update["hora_apertura"] = resultado["hora_apertura"]
    if resultado.get("hora_cierre"):
        update["hora_cierre"] = resultado["hora_cierre"]
    if resultado.get("ciudadanos_habilitados"):
        update["ciudadanos_habilitados"] = resultado["ciudadanos_habilitados"]

    update["estado"] = "OCR_COMPLETADO"
    db.actas.update_one({"id_acta": id_acta}, {"$set": update})
    db.vista_actas_estado.update_one({"_id": "global"}, {"$inc": {"actas_procesando": -1}})

    now = datetime.now(timezone.utc)
    evento_ocr = {
        "id_evento":   str(uuid.uuid4()),
        "tipo":        "ActaOCRCompletada",
        "id_acta":     id_acta,
        "codigo_mesa": codigo_mesa,
        "payload":     resultado,
        "timestamp":   now.isoformat(),
        "version":     1,
    }
    emit(TOPIC_OUT, key=str(codigo_mesa), payload=evento_ocr)
    db.eventos.insert_one({**evento_ocr, "timestamp": now})

    logger.info(
        "OCR completado — mesa=%s confianza=%.2f revision=%s",
        codigo_mesa,
        resultado.get("confianza_ocr", 0),
        resultado.get("requiere_revision", False),
    )


def main() -> None:
    logger.info("OCR Worker iniciado — escuchando '%s'", TOPIC_IN)
    consumer = _get_consumer()

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                raise KafkaException(msg.error())

            event   = json.loads(msg.value().decode("utf-8"))
            id_acta = event.get("id_acta", "?")

            try:
                _process(event)
                consumer.commit(asynchronous=False)
            except Exception as exc:
                logger.error("Error en acta %s: %s", str(id_acta)[:16], exc, exc_info=True)
                emit(TOPIC_DLQ, key=str(event.get("codigo_mesa", "0")), payload={
                    "evento_original": event,
                    "error":           str(exc),
                })
                consumer.commit(asynchronous=False)
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
