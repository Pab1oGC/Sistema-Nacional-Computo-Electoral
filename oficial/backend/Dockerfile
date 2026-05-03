# syntax=docker/dockerfile:1.7
FROM python:3.11-slim AS builder

WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Descargamos las dependencias de runtime como wheels.
# NO usamos `pip wheel -e .` porque el modo editable arrastra
# setuptools/wheel/build al graph, y luego el runtime los necesita
# pero --no-index no los puede resolver (no se descargaron).
RUN pip install --upgrade pip && \
    pip wheel --wheel-dir /wheels \
        "fastapi==0.115.5" \
        "uvicorn[standard]>=0.32.1,<0.33" \
        "pydantic>=2.9,<3" \
        "pydantic-settings>=2.6,<3" \
        "sqlalchemy>=2.0.36,<2.1" \
        "asyncpg>=0.30,<0.31" \
        "alembic>=1.14,<2"

FROM python:3.11-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels

# Instala dependencias desde wheels, SIN modo editable. El código vive
# en /app/src (mountado abajo) y se accede vía PYTHONPATH=/app/src; no
# hace falta `-e .`.
RUN pip install --no-cache-dir --no-index --find-links=/wheels \
        "fastapi==0.115.5" \
        "uvicorn[standard]>=0.32.1,<0.33" \
        "pydantic>=2.9,<3" \
        "pydantic-settings>=2.6,<3" \
        "sqlalchemy>=2.0.36,<2.1" \
        "asyncpg>=0.30,<0.31" \
        "alembic>=1.14,<2"

# Código fuente y migraciones (después del install para mejor caché:
# cambios al código no invalidan el layer de pip install).
COPY src/ ./src/
COPY alembic.ini ./
COPY alembic/ ./alembic/

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
