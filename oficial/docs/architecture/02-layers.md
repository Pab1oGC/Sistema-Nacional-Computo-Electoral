# 02 — Las 4 capas en detalle

## Propósito

Detallar qué archivos van en cada capa, qué se importa, qué NO se importa, y un ejemplo corto. La regla general (dependencias hacia adentro) está en `01-overview.md`. Las reglas técnicas con ejemplos completos están en la skill `clean-architecture-rules`.

## domain/

Carpetas:

```
backend/src/recuento_oficial/domain/
├── entities/                 (ActaOficial, Mesa, Recinto, Partido, ...)
├── value_objects/            (CodigoActa, CodigoMesa, ...)
├── repositories/             (ActaOficialRepository — Protocol)
├── services/                 (ValidadorActa)
└── exceptions.py             (ActaYaProcesadaException, ...)
```

Importa: stdlib, `typing`, `dataclasses`. Nada más.
NO importa: sqlalchemy, fastapi, pydantic, asyncpg, ni cualquier otra capa.

Ejemplo:

```python
# domain/entities/acta_oficial.py
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ActaOficial:
    id_acta: str
    codigo_acta: str        # 13 dígitos
    codigo_mesa: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int
    blancos: int
    nulos: int
    habilitados: int
    anfora: int
    no_usadas: int
    fecha_creacion: datetime
```

## application/

Carpetas:

```
backend/src/recuento_oficial/application/
├── use_cases/                (RegistrarRecuentoUseCase, ConsultarResultadosUseCase, ...)
└── dtos/                     (RegistrarRecuentoDTO, ...)
```

Importa: `domain`, stdlib.
NO importa: sqlalchemy, fastapi, pydantic, asyncpg, `infrastructure`, `presentation`.

Reglas:

- Cada use case es una clase con `__init__` que recibe sus dependencias (típicamente repositories y services del dominio) y un único método público `execute()`.
- Los DTOs son `@dataclass` planos. NO usar Pydantic acá: Pydantic es de la capa de presentación.
- Use cases lanzan excepciones de dominio (`ActaYaProcesadaException`), nunca `HTTPException`.

Ejemplo:

```python
# application/use_cases/registrar_recuento_use_case.py
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)
from recuento_oficial.domain.services.validador_acta import ValidadorActa
from recuento_oficial.domain.exceptions import ActaYaProcesadaException
from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)

class RegistrarRecuentoUseCase:
    def __init__(
        self,
        repo: ActaOficialRepository,
        validador: ValidadorActa,
    ) -> None:
        self._repo = repo
        self._validador = validador

    async def execute(self, dto: RegistrarRecuentoDTO) -> ActaOficial:
        if await self._repo.exists(dto.id_acta):
            raise ActaYaProcesadaException(dto.id_acta)
        acta = ActaOficial.from_dto(dto)
        self._validador.validar(acta)
        await self._repo.save(acta)
        return acta
```

## infrastructure/

Carpetas:

```
backend/src/recuento_oficial/infrastructure/
└── persistence/
    ├── models/               (ActaOficialORM, MesaORM, ...)
    ├── mappers/              (acta_oficial_mapper.py)
    └── repositories/         (SqlaActaOficialRepository, ...)
```

Importa: `domain`, `application`, sqlalchemy, asyncpg, otras libs externas.
NO importa: `presentation`.

Reglas:

- Los ORM models son SQLAlchemy 2.0 con `Mapped[]` y `mapped_column()`.
- Los mappers son funciones puras `entity_to_orm` / `orm_to_entity`. Sin lógica de negocio.
- Los repositories concretos implementan los `Protocol` definidos en `domain/repositories/`.
- El repository NUNCA hace `commit()`. El commit lo hace `get_session()` del DI.

Ejemplo:

```python
# infrastructure/persistence/repositories/sqla_acta_oficial_repository.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (
    ActaOficialORM,
)
from recuento_oficial.infrastructure.persistence.mappers.acta_oficial_mapper import (
    entity_to_orm, orm_to_entity,
)

class SqlaActaOficialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, acta: ActaOficial) -> None:
        self._session.add(entity_to_orm(acta))
        await self._session.flush()

    async def exists(self, id_acta: str) -> bool:
        stmt = select(1).select_from(ActaOficialORM).where(
            ActaOficialORM.id_acta == id_acta
        )
        return (await self._session.execute(stmt)).scalar() is not None
```

## presentation/

Carpetas:

```
backend/src/recuento_oficial/presentation/
├── api/v1/                   (recuento_router.py, resultados_router.py, ...)
└── schemas/                  (RegistrarRecuentoRequest, ActaOficialResponse, ...)
```

Importa: `domain`, `application`, fastapi, pydantic.
NO importa: `infrastructure` directo (solo a través de `Depends(...)` que viene de `composition_root.py`).

Reglas:

- Los routers son delgados. Reciben el use case por `Depends`, ejecutan, traducen excepciones de dominio a `HTTPException`, devuelven Pydantic.
- Los schemas Pydantic NUNCA aparecen en `domain/` o `application/`.
- Los schemas de respuesta del módulo oficial deben tener los MISMOS nombres de campo que el RRV expone en `/resultados`, `/avance`, `/inconsistencias` (ver `CLAUDE.md` sec 6).

Ejemplo:

```python
# presentation/api/v1/recuento_router.py
from fastapi import APIRouter, HTTPException

from recuento_oficial.domain.exceptions import (
    ActaYaProcesadaException, ErroresDeValidacionException,
)
from recuento_oficial.presentation.schemas.acta_oficial_schemas import (
    RegistrarRecuentoRequest, ActaOficialResponse,
)
from composition_root import RegistrarUseCaseDep

router = APIRouter(prefix="/api/v1/oficial", tags=["oficial"])

@router.post("/recuento", response_model=ActaOficialResponse, status_code=201)
async def registrar_recuento(
    request: RegistrarRecuentoRequest,
    use_case: RegistrarUseCaseDep,
) -> ActaOficialResponse:
    try:
        acta = await use_case.execute(request.to_dto())
    except ActaYaProcesadaException as e:
        raise HTTPException(409, detail=str(e))
    except ErroresDeValidacionException as e:
        raise HTTPException(422, detail=e.errores)
    return ActaOficialResponse.model_validate(acta)
```

## Tabla resumen de las 4 capas

| Capa             | Carpeta principal           | Importa                              | NO importa                       | Tipo de modelo |
|------------------|-----------------------------|--------------------------------------|----------------------------------|----------------|
| `domain`         | `domain/`                   | stdlib, typing, dataclasses          | TODO lo demás                    | Entity         |
| `application`    | `application/`              | `domain`, stdlib                     | sqlalchemy, fastapi, pydantic    | DTO            |
| `infrastructure` | `infrastructure/persistence/` | `domain`, `application`, sqlalchemy | `presentation`                   | ORM            |
| `presentation`   | `presentation/`             | `domain`, `application`, fastapi, pydantic | `infrastructure` directo  | Schema (Pydantic) |

## Verificación automática

El comando `/auditar-arquitectura` (definido en `oficial/.claude/commands/auditar-arquitectura.md`) verifica estas reglas con grep y reporta violaciones sin tocar código. Correrlo antes de cada commit grande.

## Para detalles técnicos completos

Ver la skill `clean-architecture-rules`. Tiene ejemplos correctos vs incorrectos, naming completo y los anti-patterns marcados con ❌.
