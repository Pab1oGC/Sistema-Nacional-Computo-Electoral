from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routes.health import router as health_router
from routes.ingesta import router as ingesta_router
from routes.consultas import router as consultas_router

app = FastAPI(
    title="RRV — API",
    description="Ingesta de actas electorales y consulta de resultados en tiempo real.",
    version="1.0.0",
)

app.include_router(health_router)
app.include_router(ingesta_router)
app.include_router(consultas_router)

app.mount("/dashboard", StaticFiles(directory="static", html=True), name="dashboard")
