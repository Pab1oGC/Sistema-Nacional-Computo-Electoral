# 01 — Overview de la arquitectura

## Propósito

Punto de entrada arquitectónico del módulo `oficial/`. Si esta es la primera vez que abrís el código, leelo antes que cualquier otra cosa. Los archivos `02-layers.md` a `07-testing-strategy.md` profundizan cada aspecto.

## Stack en una línea

Python 3.11 + FastAPI 0.115 + SQLAlchemy 2.0 async + PostgreSQL 16 (Mirror sync) + n8n + React 18 (dashboard propio).

## Diagrama de capas

```
┌─────────────────────────────────────────────────────────────────┐
│                       presentation/                              │
│   FastAPI routers, Pydantic schemas, mapeo HTTP <-> excepciones │
└──────────────────────────────┬──────────────────────────────────┘
                               │ depende de
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                       application/                               │
│   Use cases, DTOs. Orquesta domain. NO conoce HTTP ni SQL.      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ depende de
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                          domain/                                 │
│   Entities, value objects, repository Protocols, ValidadorActa,  │
│   excepciones de dominio. Python puro, sin imports externos.     │
└──────────────────────────────▲──────────────────────────────────┘
                               │ implementa los Protocols de
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│                     infrastructure/                              │
│   ORM models (SQLAlchemy), repositories concretos, mappers,      │
│   sesiones async. La única capa que toca PostgreSQL.            │
└─────────────────────────────────────────────────────────────────┘
```

`composition_root.py` vive fuera del diagrama: es el cableado que une las cuatro capas.

## Regla de oro

**Las dependencias apuntan hacia adentro.** Una capa interna nunca conoce a una externa.

- `domain` no depende de nadie.
- `application` solo depende de `domain`.
- `infrastructure` depende de `domain` y `application`.
- `presentation` depende de `domain` y `application` (no de `infrastructure` salvo via `composition_root`).
- `composition_root.py` es el ÚNICO archivo que importa las cuatro capas.

Si una capa interna necesita "llamar" a una externa (e.g. el use case necesita persistir un acta), defino un `Protocol` en `domain/repositories/` y la capa externa (infrastructure) lo implementa. Esto se llama Dependency Inversion Principle (la D de SOLID).

## Mapa de imports permitidos

| Capa             | Importa de                                                | NO importa                                |
|------------------|-----------------------------------------------------------|-------------------------------------------|
| `domain`         | stdlib, `typing`, `dataclasses`                            | sqlalchemy, fastapi, pydantic, asyncpg    |
| `application`    | `domain`, stdlib                                           | sqlalchemy, fastapi, pydantic, asyncpg    |
| `infrastructure` | `domain`, `application`, sqlalchemy, asyncpg, libs        | `presentation`                            |
| `presentation`   | `domain`, `application`, fastapi, pydantic                | `infrastructure` directo (solo via DI)    |

Detalle por capa con archivos y ejemplos en `02-layers.md`.

## Composition root

`backend/src/composition_root.py` cablea todo:

```
Settings ──► AsyncEngine ──► AsyncSessionFactory
                                    │
                                    ▼
                      get_session() ──► AsyncSession
                                              │
                                              ▼
                          get_acta_repo() ──► SqlaActaOficialRepository
                                                       │
                                                       ▼
                            get_registrar_use_case() ──► RegistrarRecuentoUseCase
                                                                │
                                                                ▼
                                                          router.post(...)
```

Si querés cambiar la implementación de persistencia (e.g. fakes en tests), tocás solo `composition_root.py` o reemplazás el `Depends(...)` con un override de pytest. Routers y use cases no se enteran.

## Async en todo el stack

- Routers: `async def registrar_recuento(...)`.
- Use cases: `async def execute(...)`.
- Repositories: `async def save/get/exists(...)`.
- ORM queries: `await session.execute(stmt)`.

**Excepción consciente:** funciones puras del dominio (validador, mappers, value objects). `ValidadorActa.validar()` es síncrono porque no hace I/O. Marcar todo como `async` cuando no hace falta es ruido.

## Bounded contexts

Un solo bounded context: `recuento_oficial`. Si una feature parece introducir un segundo (e.g. "auditoría avanzada", "reportes ejecutivos", "gestión de usuarios"), STOP y discutir antes de partir el código. La práctica no justifica más de uno.

## Convenciones cruzadas (resumen)

- Idioma del dominio: español (`Acta`, `Mesa`, `Recinto`, `Recuento`, `Validador`).
- Idioma del framework: inglés (`AsyncSession`, `Depends`, `Mapped`, `Settings`).
- Archivos: `snake_case.py`.
- Tipos: anotaciones obligatorias en parámetros y retorno.
- Detalle completo en `03-naming-conventions.md`.

## Para detalles técnicos completos

Ver la skill `clean-architecture-rules` (en `oficial/.claude/skills/clean-architecture-rules/SKILL.md`) que se carga automáticamente al editar archivos bajo `backend/src/`. Esa skill tiene los ejemplos de código y los anti-patterns concretos. Este overview cubre el "por qué"; la skill cubre el "cómo".
