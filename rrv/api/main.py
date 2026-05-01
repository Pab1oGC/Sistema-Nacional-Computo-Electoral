import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from routes.health import router as health_router
from routes.ingesta import router as ingesta_router
from routes.consultas import router as consultas_router
from services.mongo import get_db

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Conectando a MongoDB antes de aceptar requests...")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, get_db)
    log.info("MongoDB listo — API abierta")
    yield


app = FastAPI(
    title="RRV — API",
    description="Ingesta de actas electorales y consulta de resultados en tiempo real.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(ingesta_router)
app.include_router(consultas_router)

app.mount("/dashboard", StaticFiles(directory="static", html=True), name="dashboard")
