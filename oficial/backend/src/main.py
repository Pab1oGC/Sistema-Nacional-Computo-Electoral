import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from recuento_oficial.presentation.api.v1.actas_router import router as actas_router
from recuento_oficial.presentation.api.v1.admin_router import router as admin_router
from recuento_oficial.presentation.api.v1.avance_router import router as avance_router
from recuento_oficial.presentation.api.v1.candidatos_router import (
    router as candidatos_router,
)
from recuento_oficial.presentation.api.v1.health_router import router as health_router
from recuento_oficial.presentation.api.v1.inconsistencias_router import (
    router as inconsistencias_router,
)
from recuento_oficial.presentation.api.v1.recuento_router import (
    router as recuento_router,
)
from recuento_oficial.presentation.api.v1.replicacion_router import (
    router as replicacion_router,
)
from recuento_oficial.presentation.api.v1.resultados_router import (
    router as resultados_router,
)
from shared.infrastructure.database.session import get_engine
from shared.infrastructure.database.settings import get_settings


def configure_logging() -> None:
    logging.basicConfig(
        level=get_settings().log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log = logging.getLogger("oficial.startup")
    log.info("Iniciando API Cómputo Oficial")
    # Forzar creación del engine para detectar problemas de config en startup
    get_engine()
    yield
    log.info("Cerrando API Cómputo Oficial")
    await get_engine().dispose()


app = FastAPI(
    title="Cómputo Oficial - API",
    description=(
        "API del módulo Cómputo Oficial. Recibe transcripciones validadas "
        "vía n8n o formulario web y publica resultados oficiales con "
        "consistencia fuerte (PostgreSQL Mirror síncrono, RPO=0)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(health_router)
app.include_router(recuento_router)
app.include_router(resultados_router)
app.include_router(avance_router)
app.include_router(actas_router)
app.include_router(inconsistencias_router)
app.include_router(candidatos_router)
app.include_router(replicacion_router)
app.include_router(admin_router)
