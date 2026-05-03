# 03 — Convenciones de naming

## Propósito

Reglas de nombres consistentes en todo el módulo. La consistencia importa porque permite navegar el código rápido: si veo `SqlaActaOficialRepository` sé que es la implementación concreta del Protocol `ActaOficialRepository`. Sin esta convención, cada archivo es un misterio.

## Idioma

Mezclamos español e inglés deliberadamente:

- **Español** para vocabulario del dominio: `Acta`, `Mesa`, `Recinto`, `Partido`, `Recuento`, `Validador`, `Departamento`, `Municipio`, `Provincia`.
- **Inglés** para vocabulario del framework: `AsyncSession`, `Depends`, `Mapped`, `Settings`, `Repository`, `UseCase`, `DTO`, `Request`, `Response`.

Esto se debe a que el dominio (acta electoral, recuento, mesa) es local. El framework (FastAPI, SQLAlchemy) es internacional. Mezclar idiomas en una clase es OK si cada palabra está en su rol: `RegistrarRecuentoUseCase` (verbo+dominio en español, sufijo en inglés).

Excepción: nombres de variables locales y de parámetros pueden ir en español si el contexto es de dominio (`acta`, `mesa`, `votos`). Si es de infraestructura, en inglés (`session`, `engine`, `request`).

## Sufijos por tipo

Sufijos obligatorios. Si un archivo no sigue la convención, se renombra.

| Concepto                | Sufijo / patrón           | Ejemplo                          | Ubicación                                    |
|-------------------------|---------------------------|----------------------------------|----------------------------------------------|
| Repository protocol     | `Repository`              | `ActaOficialRepository`          | `domain/repositories/`                        |
| Repository SQLAlchemy   | `Sqla<X>Repository`       | `SqlaActaOficialRepository`      | `infrastructure/persistence/repositories/`    |
| Repository fake (tests) | `Fake<X>Repository`       | `FakeActaOficialRepository`      | `tests/unit/fakes/`                           |
| ORM model               | `<X>ORM`                  | `ActaOficialORM`                 | `infrastructure/persistence/models/`          |
| Mapper                  | módulo `<x>_mapper.py`    | `acta_oficial_mapper.py`         | `infrastructure/persistence/mappers/`         |
| Use case                | `<Verbo><X>UseCase`       | `RegistrarRecuentoUseCase`       | `application/use_cases/`                      |
| DTO de application      | `<X>DTO`                  | `RegistrarRecuentoDTO`           | `application/dtos/`                           |
| Pydantic request        | `<X>Request`              | `RegistrarRecuentoRequest`       | `presentation/schemas/`                        |
| Pydantic response       | `<X>Response`             | `ActaOficialResponse`            | `presentation/schemas/`                        |
| Excepción de dominio    | `<Concepto>Exception`     | `ActaYaProcesadaException`       | `domain/exceptions.py`                        |
| Value object            | sin sufijo                | `CodigoActa`, `CodigoMesa`       | `domain/value_objects/`                       |
| Service de dominio      | sin sufijo (verbo+sustantivo) | `ValidadorActa`               | `domain/services/`                            |

## Naming de archivos

- Siempre `snake_case.py`. Nunca PascalCase ni kebab-case en archivos Python.
- El nombre del archivo refleja el nombre de la clase principal: `ActaOficial` vive en `acta_oficial.py`, `RegistrarRecuentoUseCase` vive en `registrar_recuento_use_case.py`.
- Si un archivo tiene varias clases relacionadas (e.g. varios DTOs del mismo flujo), nombre genérico: `recuento_dtos.py`.

## Naming de routers FastAPI

Cada agregado tiene su router en un archivo separado:

```
presentation/api/v1/
├── recuento_router.py        (POST /recuento)
├── resultados_router.py      (GET /resultados, /avance)
├── actas_router.py           (GET /actas, /actas/{id})
├── inconsistencias_router.py (GET /inconsistencias)
├── candidatos_router.py      (GET /candidatos)
├── replicacion_router.py     (GET /replicacion/estado)
└── health_router.py          (GET /health)
```

El prefijo `/api/v1/oficial` se aplica al `APIRouter` correspondiente, no al main. Esto permite tests de routers individuales sin levantar toda la app.

## Naming de tests

```
tests/
├── unit/
│   ├── domain/
│   │   ├── test_validador_acta.py
│   │   └── entities/
│   │       └── test_acta_oficial.py
│   ├── application/
│   │   └── test_registrar_recuento_use_case.py
│   └── fakes/
│       └── fake_acta_oficial_repository.py
└── integration/
    ├── test_recuento_api.py
    └── test_replicacion.py
```

- Los archivos de tests siempre empiezan con `test_`.
- Las funciones de test siempre empiezan con `test_` y describen el escenario en español: `test_registrar_recuento_devuelve_error_si_acta_ya_existe`.

## Imports ordenados

Orden obligatorio en cada archivo Python. Una línea en blanco entre grupos.

```python
# 1. Stdlib
from datetime import datetime
from typing import Annotated

# 2. Third-party
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# 3. Shared (módulos comunes del backend)
from shared.infrastructure.database.session import get_session_factory

# 4. Mismo bounded context
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)
from recuento_oficial.application.use_cases.registrar_recuento_use_case import (
    RegistrarRecuentoUseCase,
)
```

Reglas adicionales:

- Una línea en blanco entre los 4 grupos.
- Dentro de un grupo, alfabético.
- Imports relativos (`.`, `..`) están prohibidos. Siempre usar paths absolutos desde `recuento_oficial.` o `shared.`.

## Constantes y enums

- Constantes a nivel módulo: `UPPER_SNAKE_CASE`. Ejemplo: `CODIGO_ACTA_LENGTH = 13`.
- Enums: PascalCase para la clase, UPPER_SNAKE_CASE para los miembros.

```python
from enum import Enum

class TipoEntradaOficial(str, Enum):
    FORM = "FORM"
```

`TipoEntradaOficial.FORM.value == "FORM"` se usa en los schemas de response para distinguir mis actas de las del RRV (`'FOTO' | 'SMS'`). Ver `CLAUDE.md` sec 6.

## Tipos hint

Anotaciones obligatorias en TODA función pública:

```python
async def registrar(self, dto: RegistrarRecuentoDTO) -> ActaOficial:
    ...
```

Variables locales: opcional, salvo cuando el tipo no es obvio del contexto:

```python
candidatos: list[Partido] = []                # OK, evidente sin tipo
total: int = sum(p.votos for p in candidatos)  # OK, opcional
```

## Mensajes de excepciones

Las excepciones de dominio llevan mensaje en español, copiado literal del enunciado del docente cuando aplica (Error1 a Error4). Ver `04-validation-rules.md` para los textos exactos.

## Para detalles técnicos completos

Las skills `clean-architecture-rules` y `fastapi-async-clean-arch` tienen ejemplos extendidos de cada convención.
