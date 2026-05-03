# Backend - Cómputo Oficial

API FastAPI del módulo Cómputo Oficial.

## Stack

- Python 3.11
- FastAPI 0.115
- SQLAlchemy 2.0 (async) + asyncpg
- PostgreSQL 16 con replicación Mirror síncrona
- Alembic para migraciones incrementales (baseline NO-OP, schema inicial vive en `oficial/sql/01-schema.sql`)

## Layout

Ver `oficial/docs/architecture/02-layers.md` para el detalle de cada capa.

```
src/
├── main.py
├── composition_root.py
├── shared/
│   ├── domain/value_objects/
│   └── infrastructure/database/
└── recuento_oficial/
    ├── domain/
    ├── application/
    ├── infrastructure/
    └── presentation/
```

## Instalación local

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

## Correr local (sin Docker)

Requiere PostgreSQL accesible en la URL configurada en `.env`.

```bash
uvicorn main:app --reload --app-dir src --port 8001
```

## Correr con Docker

Desde la raíz del repo (`Sistema-Nacional-Computo-Electoral/oficial/`):

```bash
docker compose -f docker-compose.oficial.yml up -d oficial_api
```

## Tests

```bash
pytest                                  # toda la suite
pytest -m "not integration"             # solo unit (rápido)
pytest --cov=src --cov-report=term-missing
```

Los tests `integration` se saltean si `DB_URL_TEST` no está seteada.

## Endpoints expuestos

- `POST /api/v1/oficial/recuento`
- `GET  /api/v1/oficial/resultados`
- `GET  /api/v1/oficial/avance`
- `GET  /api/v1/oficial/actas` y `/actas/{id_acta}`
- `GET  /api/v1/oficial/inconsistencias`
- `GET  /api/v1/oficial/candidatos`
- `GET  /api/v1/oficial/replicacion/estado`
- `GET  /health`

## Ground truth para tests

Acta `1010200001001` con `habilitados=877`, `anfora=788`, `no_usadas=89`. Fixture en `tests/fixtures/acta_1010200001001.json`.
