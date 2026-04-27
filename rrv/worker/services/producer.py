import json
import logging
from kafka import KafkaProducer
from config import settings

logger = logging.getLogger(__name__)

_producer: KafkaProducer | None = None


def get_producer() -> KafkaProducer:
    global _producer
    if _producer is None:
        _producer = KafkaProducer(
            bootstrap_servers=[settings.kafka_bootstrap],
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            retries=5,
            acks="all",
        )
    return _producer


def emit(topic: str, key: str, payload: dict) -> None:
    producer = get_producer()
    future = producer.send(topic, key=key, value=payload)
    producer.flush(timeout=5)
    future.get(timeout=10)
