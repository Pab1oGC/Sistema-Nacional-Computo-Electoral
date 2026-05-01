import json
import logging
from confluent_kafka import Producer, KafkaException
from config import settings

logger = logging.getLogger(__name__)

_producer: Producer | None = None


def _new_producer() -> Producer:
    return Producer({
        "bootstrap.servers": settings.kafka_bootstrap,
        "acks": "all",
        "retries": 5,
        "message.timeout.ms": 20000,
        "socket.timeout.ms": 10000,
        "reconnect.backoff.ms": 500,
        "reconnect.backoff.max.ms": 5000,
    })


def get_producer() -> Producer:
    global _producer
    if _producer is None:
        _producer = _new_producer()
    return _producer


def emit(topic: str, key: str, payload: dict) -> None:
    global _producer
    encoded_value = json.dumps(payload, default=str).encode("utf-8")
    encoded_key = key.encode("utf-8") if key else None

    delivery_errors: list = []

    def _on_delivery(err, msg):
        if err:
            delivery_errors.append(err)

    for attempt in range(3):
        try:
            if _producer is None:
                _producer = _new_producer()
            _producer.produce(topic, key=encoded_key, value=encoded_value, callback=_on_delivery)
            _producer.flush(timeout=20)
            if delivery_errors:
                raise KafkaException(delivery_errors[0])
            return
        except Exception as exc:
            logger.warning("Kafka emit intento %d fallido: %s", attempt + 1, exc)
            try:
                if _producer is not None:
                    _producer.flush(timeout=1)
            except Exception:
                pass
            _producer = None
            delivery_errors.clear()

    raise RuntimeError(f"Kafka emit fallido tras 3 intentos en topic={topic}")
