# 07 — Estrategia de testing

## Propósito

Cómo testeamos el módulo. Pirámide invertida (más unit que integration que E2E), fakes en lugar de mocks, datos de prueba reproducibles.

## Pirámide de tests

```
              /\
             /  \   E2E (mínimo): smoke test del flujo n8n -> API -> BD
            /────\
           /      \  Integration (clave): API + PostgreSQL real
          /────────\
         /          \  Unit (mayoría): domain + application
        /────────────\
```

Distribución aproximada de tests:

- **Unit:** ~70% del total. Rápidos (~1ms cada uno), sin I/O. Cubren `domain/` y `application/` con fakes.
- **Integration:** ~25% del total. Levantan PostgreSQL en una BD de test, exercitan el API completo via `httpx.AsyncClient`.
- **E2E:** ~5% del total. Manuales en su mayoría: levantar todo el stack y correr el workflow de n8n contra el API real.

## Fakes en lugar de mocks

Para testear use cases sin BD, NO usamos `unittest.mock` ni `MagicMock`. Usamos fakes: implementaciones reales en memoria del Repository Protocol.

```python
# tests/unit/fakes/fake_acta_oficial_repository.py
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)

class FakeActaOficialRepository:
    def __init__(self) -> None:
        self._store: dict[str, ActaOficial] = {}

    async def save(self, acta: ActaOficial) -> None:
        self._store[acta.id_acta] = acta

    async def get_by_id(self, id_acta: str) -> ActaOficial | None:
        return self._store.get(id_acta)

    async def exists(self, id_acta: str) -> bool:
        return id_acta in self._store
```

Por qué fakes y no mocks:

1. Los fakes implementan el Protocol completo. Un cambio de interfaz rompe el fake en compilación, no en runtime.
2. Los tests son más legibles: `repo.exists("123")` vs `repo.exists.return_value = True`.
3. Permite tests con varias operaciones encadenadas sin configurar un mock por cada una.
4. Soporta type checking (mypy/pyright) sin ignores.

Mocks solo para librerías externas que no controlamos (e.g. cliente HTTP a un servicio externo). En este módulo no hay casos así.

## Cobertura objetivo

| Capa                                     | Cobertura mínima | Justificación                              |
|------------------------------------------|------------------|--------------------------------------------|
| `domain/entities/`                       | 100%             | Lógica pura, no hay excusa para no cubrir.|
| `domain/value_objects/`                  | 100%             | Idem.                                      |
| `domain/services/` (`ValidadorActa`)     | 100%             | Las 4 reglas Error1-4 son el corazón del sistema. |
| `application/use_cases/`                 | 90%+             | Cubrir happy path + cada excepción.       |
| `infrastructure/persistence/`            | 70%+             | Repositories se cubren con tests de integración. |
| `presentation/api/`                      | 50%+             | Smoke tests por endpoint, no exhaustivo.   |

`pytest --cov=src --cov-report=term-missing` en CI. Si baja del 80% en domain o application, falla el build.

## Datos de prueba: ground truth

El acta `1010200001001` es la fixture canónica (ver `04-validation-rules.md`):

```
codigo_acta:  1010200001001
habilitados:  877
anfora:       788
no_usadas:    89
```

Vive en `tests/fixtures/acta_1010200001001.json` con todos los campos completos (votos_pN, blancos, nulos consistentes con Error1 y Error2).

Variantes para casos negativos (en la misma carpeta):

- `acta_error1_falta_papeleta.json` (anfora reducido en 1).
- `acta_error1_sobra_papeleta.json` (anfora aumentado en 1).
- `acta_error2_validos_inconsistentes.json` (suma de votos no balancea).

## Comandos pytest

### Toda la suite con cobertura:

```bash
cd backend && pytest tests/unit/ -v --cov=src --cov-report=term-missing
cd backend && pytest tests/integration/ -v
```

### Solo un dominio específico:

```bash
pytest tests/unit/domain/test_validador_acta.py -v
```

### Solo tests que fallan en la última corrida:

```bash
pytest --lf
```

### Con paralelismo (pytest-xdist):

```bash
pytest tests/unit/ -n auto
```

El comando `/tests` (en `.claude/commands/`) corre la suite completa con reporte por capa.

## Tests de integración: BD real

Los tests bajo `tests/integration/` requieren una BD de test (`oficial_test`) levantada por separado. NO usar la misma BD del cluster productivo.

Cada test se ejecuta dentro de una transacción que se rollea al final, así no hay state leak entre tests. Pattern:

```python
@pytest.fixture
async def db_session():
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine_test)() as session:
        yield session
        await session.rollback()
```

## Tests de routers

Usar `httpx.AsyncClient` con `ASGITransport(app)` para exercitar la app sin servidor real:

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_post_recuento_devuelve_201_con_acta_consistente():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open("tests/fixtures/acta_1010200001001.json") as f:
            payload = json.load(f)
        r = await client.post("/api/v1/oficial/recuento", json=payload)
    assert r.status_code == 201
    assert r.json()["tipo"] == "FORM"
```

## Tests del validador (las 4 reglas)

Casos mínimos para `tests/unit/domain/test_validador_acta.py`:

- Acta consistente → no lanza.
- Acta con Error1 (papeletas faltantes) → lanza con mensaje literal del enunciado.
- Acta con Error1 (papeletas sobrantes) → lanza con signo `+`.
- Acta con Error2 (votos no balancean) → lanza con mensaje de Error2.
- Acta con Error1 + Error2 simultáneos → lanza con AMBOS mensajes en `errores`.

Verificar el mensaje literal con `assert "no usadas, hay una diferencia de" in str(exc)`. No parafrasear: el evaluador busca la cadena exacta.

## Tests de Error3 y Error4

Como requieren BD, viven en use cases con fake repository:

```python
@pytest.mark.asyncio
async def test_registrar_recuento_lanza_error4_si_acta_existe():
    repo = FakeActaOficialRepository()
    await repo.save(acta_existente)   # arrange
    use_case = RegistrarRecuentoUseCase(repo, ValidadorActa())

    with pytest.raises(ActaYaProcesadaException) as exc:
        await use_case.execute(dto_misma_acta)
    assert "ya ha sido procesada en la BDD TREP/OFICIAL" in str(exc.value)
```

## E2E manual

No se automatiza. Procedimiento:

1. `/levantar` (todo el stack arriba).
2. `/cargar-datos` (catálogos cargados).
3. `/n8n-importar` (workflow listo).
4. Disparar el workflow desde la UI de n8n.
5. Verificar que `oficial.acta_oficial` tenga 5396 filas.
6. Verificar `errores.csv` (debería estar vacío con un CSV bien formado).

## Para detalles técnicos completos

Ver la skill `fastapi-async-clean-arch` para patrones de tests asíncronos y la skill `clean-architecture-rules` para el patrón de fakes.
