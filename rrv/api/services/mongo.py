import logging
import time
from pymongo import MongoClient
from pymongo.database import Database

from config import settings

log = logging.getLogger(__name__)

_DB_NAME = "rrv_db"
_client: MongoClient | None = None

_LOCAL_NODES = (
    ("mongo1", 27017),
    ("mongo2", 27018),
    ("mongo3", 27019),
)
_LOCAL_HOST = "127.0.0.1"


def _try_configured_uri() -> MongoClient | None:
    try:
        c = MongoClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000,
            socketTimeoutMS=15000,
        )
        info = c.admin.command("hello")
        if info.get("isWritablePrimary"):
            log.info("MongoDB primario listo usando MONGO_URI")
            return c
        c.close()
    except Exception as exc:
        log.info("MONGO_URI no disponible, probando puertos locales: %s", exc)
    return None


def _try_local_primary() -> MongoClient | None:
    for name, port in _LOCAL_NODES:
        try:
            c = MongoClient(
                f"mongodb://{_LOCAL_HOST}:{port}",
                directConnection=True,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=2000,
                socketTimeoutMS=15000,
            )
            info = c.admin.command("hello")
            if info.get("isWritablePrimary"):
                log.info("MongoDB primario listo en %s %s:%s", name, _LOCAL_HOST, port)
                return c
            c.close()
        except Exception:
            pass
    return None


def _wait_primary(timeout_s: int = 90) -> MongoClient:
    deadline = time.monotonic() + timeout_s
    attempt = 0
    while True:
        attempt += 1
        client = _try_configured_uri() or _try_local_primary()
        if client is not None:
            return client

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("MongoDB primario no disponible tras 90s. Ejecuta infra_start.ps1 y revisa Docker.")
        log.info("Esperando primario MongoDB (intento %d)...", attempt)
        time.sleep(min(3, remaining))


def _client_is_primary(client: MongoClient) -> bool:
    try:
        return bool(client.admin.command("hello").get("isWritablePrimary"))
    except Exception:
        return False


def get_db() -> Database:
    global _client
    if _client is None or not _client_is_primary(_client):
        if _client is not None:
            try:
                _client.close()
            except Exception:
                pass
        _client = _wait_primary()
    return _client[_DB_NAME]
