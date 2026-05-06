"""Session factory dual master/replica con failover automático.

FASE 7A:
- get_session(): writes y reads contra el primary actual.
- get_replica_engine() / get_read_session(): reads con fallback al
  replica si master falla.
- check_cluster_health(): probe de cada nodo, devuelve estado.

FASE 7B (failover automático de escrituras):
- Estado global: _current_primary ('master'|'replica'), _last_failover_at
- _failover_lock: asyncio.Lock que serializa el promote entre requests
- get_session(): captura errores de conexión, dispara _trigger_failover(),
  reintenta una vez sobre el nuevo primary
- _trigger_failover(): pg_promote() en la réplica, espera 3s, valida
  que ya no esté en recovery, switch del current primary
"""

import asyncio
import logging
import socket
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from shared.infrastructure.database.settings import get_settings

logger = logging.getLogger(__name__)


# ─── Estado global del cluster (FASE 7B) ────────────────────────────
# Solo puede ser modificado bajo _failover_lock. Lecturas son atómicas
# por el GIL de Python (asignar un str es atómico).
_current_primary: str = "master"  # 'master' | 'replica'
_failover_lock: asyncio.Lock | None = None  # se inicializa lazy en el loop
_last_failover_at: datetime | None = None


def _get_failover_lock() -> asyncio.Lock:
    """Inicializa el Lock dentro del event loop activo (lazy)."""
    global _failover_lock
    if _failover_lock is None:
        _failover_lock = asyncio.Lock()
    return _failover_lock


def get_current_primary() -> str:
    return _current_primary


def get_last_failover_at() -> datetime | None:
    return _last_failover_at


# ─── Engines: uno por nodo, instanciados al primer get ──────────────
_master_engine: AsyncEngine | None = None
_replica_writer_engine: AsyncEngine | None = None
_replica_reader_engine: AsyncEngine | None = None


def _build_engine(url: str, pool_size: int = 10) -> AsyncEngine:
    return create_async_engine(
        url,
        pool_size=pool_size,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )


def _get_master_engine() -> AsyncEngine:
    global _master_engine
    if _master_engine is None:
        _master_engine = _build_engine(get_settings().db_url, pool_size=10)
    return _master_engine


def _get_replica_writer_engine() -> AsyncEngine:
    global _replica_writer_engine
    if _replica_writer_engine is None:
        _replica_writer_engine = _build_engine(
            get_settings().db_url_replica_as_primary, pool_size=10,
        )
    return _replica_writer_engine


def get_engine() -> AsyncEngine:
    """Engine de escrituras según el primary actual.

    Si current='master': el engine al master.
    Si current='replica': el engine al ex-réplica con oficial_writer
    (post-failover; la ex-réplica ya está promovida y acepta escrituras).
    """
    if _current_primary == "master":
        return _get_master_engine()
    return _get_replica_writer_engine()


def get_replica_engine() -> AsyncEngine:
    """Engine al réplica con dashboard_ro (para fallback de lecturas).

    Atención: este engine tiene un user read-only y por lo tanto NO
    sirve para escrituras post-failover. Para writes post-failover se
    usa _get_replica_writer_engine(), que es lo que get_engine() retorna
    cuando _current_primary == 'replica'.
    """
    global _replica_reader_engine
    if _replica_reader_engine is None:
        _replica_reader_engine = _build_engine(
            get_settings().db_url_replica, pool_size=5,
        )
    return _replica_reader_engine


def _make_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=engine, expire_on_commit=False)


# ─── Failover automático ────────────────────────────────────────────


_CONN_ERROR_KEYWORDS = (
    "connection refused",
    "could not connect",
    "server closed the connection",
    "connection was closed",
    "connection reset",
    "name or service not known",
    "no route to host",
    "timeout expired",
    "name resolution",
    "connection does not exist",
    "no host found",
    "host is unreachable",
)

_CONN_ERROR_TYPE_NAMES = frozenset(
    (
        "ConnectionDoesNotExistError",
        "InterfaceError",
        "CannotConnectNowError",
        "ConnectionRefusedError",
        "gaierror",  # socket.gaierror — DNS / nombre no resuelto
    )
)


def _is_connection_error(exc: BaseException) -> bool:
    """Detecta si la excepción indica que el primary actual está caído.

    Walk through __cause__ y __context__: SQLAlchemy a veces envuelve la
    excepción del driver, a veces no. asyncpg también puede levantar
    socket.gaierror raw cuando el hostname no resuelve.
    """
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))

        # OSError = gaierror, ConnectionRefusedError, TimeoutError, etc.
        # Cubre el caso de docker stop oficial_master (DNS deja de
        # resolver el hostname), connection refused, etc.
        if isinstance(cur, (socket.gaierror, ConnectionError, TimeoutError)):
            return True

        # SQLAlchemy / DBAPI con mensajes conocidos
        if isinstance(cur, (OperationalError, DBAPIError)):
            msg = str(cur).lower()
            if any(k in msg for k in _CONN_ERROR_KEYWORDS):
                return True

        # Por nombre de tipo (asyncpg directo)
        if type(cur).__name__ in _CONN_ERROR_TYPE_NAMES:
            return True

        # Subir por la cadena de causas
        cur = cur.__cause__ if cur.__cause__ is not None else cur.__context__

    return False


async def _trigger_failover() -> None:
    """Promueve la réplica a primary y switchea el current_primary.

    Idempotente: si otro worker ya promovió mientras esperaba el lock,
    detecta el cambio y retorna sin re-promover.
    """
    global _current_primary, _last_failover_at

    lock = _get_failover_lock()
    async with lock:
        if _current_primary != "master":
            logger.info(
                "Failover already in progress or completed by another task "
                "(current_primary=%s). Skipping.",
                _current_primary,
            )
            return

        logger.warning(
            "Master unreachable. Initiating failover to replica."
        )

        replica_engine = _get_replica_writer_engine()

        # 1. Confirmar que la réplica responde y está en recovery (es standby)
        try:
            async with replica_engine.connect() as conn:
                row = (await conn.execute(text("SELECT pg_is_in_recovery();"))).first()
                in_recovery = bool(row[0]) if row else False
                if not in_recovery:
                    # La réplica ya no es standby. Probablemente otro worker
                    # promovió. Igual switcheamos.
                    logger.info(
                        "Replica is already not in recovery. "
                        "Assuming external promote already happened."
                    )
                else:
                    # 2. Ejecutar pg_promote()
                    await conn.execute(text("SELECT pg_promote();"))
                    logger.info("pg_promote() executed on replica.")
        except Exception as exc:
            logger.error("pg_promote attempt failed: %s", exc)
            raise

        # 2.b Defensa en profundidad: forzar settings async en la ex-réplica.
        # Si la replica fue clonada del master ANTES de FASE 7A, su
        # postgresql.auto.conf local heredó synchronous_standby_names
        # apuntando a sí misma → los INSERTs post-promote se cuelgan
        # esperando ack de un standby que no existe.
        # ALTER SYSTEM no corre en transacción; usamos AUTOCOMMIT.
        # Si esto falla NO es fatal: replicas nuevas (post-FASE 7A) ya
        # nacen con async config heredada y no necesitan este reset.
        try:
            autocommit_engine = replica_engine.execution_options(
                isolation_level="AUTOCOMMIT"
            )
            async with autocommit_engine.connect() as conn:
                await conn.execute(text(
                    "ALTER SYSTEM SET synchronous_commit = 'local'"
                ))
                await conn.execute(text(
                    "ALTER SYSTEM SET synchronous_standby_names = ''"
                ))
                await conn.execute(text("SELECT pg_reload_conf()"))
            logger.info(
                "synchronous_commit=local applied on ex-replica (writes unblocked)."
            )
        except Exception as exc:
            # No fatal: si la replica nació async, el ALTER SYSTEM no
            # cambia nada y los INSERTs ya funcionan. Solo logueamos.
            logger.warning(
                "Could not apply async params to ex-replica (non-fatal, "
                "replica may already be async): %s",
                str(exc)[:200],
            )

        # 3. Esperar a que el promote complete (PG default: ~unos segundos)
        for attempt in range(10):
            await asyncio.sleep(1)
            try:
                async with replica_engine.connect() as conn:
                    row = (
                        await conn.execute(text("SELECT pg_is_in_recovery();"))
                    ).first()
                    in_recovery = bool(row[0]) if row else True
                if not in_recovery:
                    logger.info(
                        "Promote confirmed after %ds. Replica is now primary.",
                        attempt + 1,
                    )
                    break
            except Exception as exc:
                logger.warning("Health check during promote (%d): %s", attempt, exc)
        else:
            logger.error("Promote did not complete within 10 seconds")
            raise RuntimeError("Promote did not complete in time")

        # 4. Switch
        _current_primary = "replica"
        _last_failover_at = datetime.now(timezone.utc)
        logger.warning(
            "Failover complete. New primary: oficial_replica (was master). "
            "Subsequent writes go to ex-replica."
        )


# ─── Session dependencies ────────────────────────────────────────────


async def get_session() -> AsyncIterator[AsyncSession]:
    """Sesión async para escrituras con failover automático.

    [DEBUG] FASE 7B: instrumentado con logs DEBUG-level para diagnosticar
    timing de checkout/connection en el path post-failover.

    Flujo:
    1. Abre sesión contra el primary actual.
    2. Yield al handler.
    3. Si commit/queries fallan con error de conexión Y current='master':
       a. Cierra sesión actual sin commit
       b. Trigger _trigger_failover() (con lock)
       c. Re-abre sesión contra el nuevo primary (ex-réplica)
       d. Re-raise para que el caller (use case + router) reintente
          (no podemos reproducir las queries que ya corrieron en el yield)
    4. Si current era 'replica' y aun así falla, propaga la excepción.

    Importante: el RETRY no lo hacemos acá. Disparamos el failover y
    re-raise. El frontend ve un 5xx, retry-with-backoff manda otro POST,
    y el segundo POST cae sobre el ex-réplica recién promovida.
    Patrón "fail fast → retry from client" en lugar de "swallow + reintent
    en server" porque las escrituras pueden no ser idempotentes a nivel
    bajo (parcial-commit).
    """
    engine = get_engine()
    logger.info(
        "get_session() entry: current_primary=%s, engine.url=%s",
        _current_primary,
        str(engine.url).replace(":oficial_2025", ":***").replace(":dash_2025", ":***"),
    )
    factory = _make_factory(engine)
    failover_done = False
    async with factory() as session:
        try:
            yield session
            await session.commit()
            return
        except Exception as exc:
            try:
                await session.rollback()
            except Exception:
                pass
            if _is_connection_error(exc) and _current_primary == "master":
                # No bloqueamos al caller con el promote acá: lo disparamos
                # en background. El próximo retry del frontend cae sobre
                # el nuevo primary.
                try:
                    await _trigger_failover()
                    failover_done = True
                except Exception as fexc:
                    logger.error("Failover trigger failed: %s", fexc)
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass
    # nada más que hacer; si failover_done es True, próximas requests
    # van al nuevo primary automáticamente vía get_engine()
    _ = failover_done


async def get_read_session() -> AsyncIterator[AsyncSession]:
    """Sesión async para lecturas con fallback al réplica si master cae.

    En FASE 7B sigue priorizando el primary actual. Si falla, fallback
    a la réplica (con dashboard_ro). NO dispara promote: las lecturas
    pueden vivir con un fallback read-only puro.
    """
    primary_engine = get_engine()
    try:
        async with primary_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        async with _make_factory(primary_engine)() as session:
            try:
                yield session
            finally:
                await session.close()
        return
    except Exception:
        pass

    async with _make_factory(get_replica_engine())() as session:
        try:
            yield session
        finally:
            await session.close()


# ─── Health checks (cluster status) ──────────────────────────────────


@dataclass
class NodeHealth:
    host: str
    is_alive: bool
    is_in_recovery: bool | None
    error: str | None


async def check_node_health(engine: AsyncEngine, host_label: str) -> NodeHealth:
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT pg_is_in_recovery();"))
            row = result.first()
            in_recovery = bool(row[0]) if row is not None else False
            return NodeHealth(
                host=host_label,
                is_alive=True,
                is_in_recovery=in_recovery,
                error=None,
            )
    except Exception as exc:
        return NodeHealth(
            host=host_label,
            is_alive=False,
            is_in_recovery=None,
            error=str(exc)[:200],
        )


async def check_cluster_health() -> tuple[NodeHealth, NodeHealth]:
    """Health check de master + replica. Usa engines fijos por host
    (no get_engine()) para que el reporte sea siempre consistente con
    los nombres físicos."""
    master = await check_node_health(_get_master_engine(), "oficial_master")
    replica = await check_node_health(get_replica_engine(), "oficial_replica")
    return master, replica


# ─── Backwards compat: factory exportada para código que la importa ──


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Compat shim. Devuelve un factory bound al engine actual.

    No cachear. Si current_primary cambia post-failover, esta función
    devuelve un factory al nuevo primary en la siguiente llamada.
    """
    return _make_factory(get_engine())
