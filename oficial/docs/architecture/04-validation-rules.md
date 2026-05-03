# 04 — Reglas de validación Error1 a Error4

## Propósito

Las 4 reglas de validación obligatorias del enunciado del docente. Los mensajes son literales: el evaluador los va a buscar tal cual aparecen acá. NO parafrasear.

Origen: enunciado de la Práctica 4, replicado en `CLAUDE.md` sec 7. Este documento extiende con dónde vive cada regla en el código y por qué.

## Las 4 reglas con sus mensajes literales

### ERROR1: balance de papeletas

Validar que `habilitados = ánfora + no_usadas`.

Mensaje literal:

> "Son XXX ciudadanos, hay YYY papeletas en el ánfora y ZZ papeletas no usadas, hay una diferencia de +/-N papeletas"

Donde:

- `XXX` = `habilitados`.
- `YYY` = `anfora`.
- `ZZ` = `no_usadas`.
- `N` = `habilitados - (anfora + no_usadas)`. Puede ser positivo o negativo; se prefija con `+` o `-` según signo.

### ERROR2: balance de votos

Una sola ecuación: `anfora == votos_p1 + votos_p2 + votos_p3 + votos_p4 + blancos + nulos`.

Si la ecuación no balancea, ERROR2.

Mensaje literal:

> "Son XXX votos por partidos, YYY votos blancos y ZZZ votos nulos no inciden con la cantidad de boletas en el ánfora +/-N"

Donde:

- `XXX` = `votos_p1 + votos_p2 + votos_p3 + votos_p4`.
- `YYY` = `blancos`.
- `ZZZ` = `nulos`.
- `N` = `(votos_p1+votos_p2+votos_p3+votos_p4+blancos+nulos) - anfora`. Signo según corresponda.

Nota sobre terminología "votos válidos": en el Excel del docente, la columna `VotosValidos` contiene SOLO la suma de votos por partidos (`p1+p2+p3+p4`), y los blancos se contabilizan aparte. El validador chequea directamente la ecuación arriba sin usar el concepto intermedio "válidos". Esta convención coincide con el formato real del acta OEP boliviana.

### ERROR3: acta no existe

El `codigo_acta` o `id_acta` recibido no aparece en la BDD oficial. Aplicable en operaciones de consulta o actualización.

Mensaje literal:

> "El acta XXX no se encuentra en la BDD TREP/OFICIAL"

Donde `XXX` = `codigo_acta` recibido.

### ERROR4: acta ya procesada (idempotencia)

El `id_acta` ya existe en la tabla `oficial.acta_oficial`. Aplicable solo en `POST /recuento`.

Mensaje literal:

> "El acta XXX ya ha sido procesada en la BDD TREP/OFICIAL"

Donde `XXX` = `codigo_acta` recibido.

## Dónde vive cada regla en el código

| Regla   | Capa                              | Razón                                                                |
|---------|-----------------------------------|----------------------------------------------------------------------|
| Error1  | `domain/services/ValidadorActa`   | Solo necesita aritmética sobre la entity. Validable sin BD.           |
| Error2  | `domain/services/ValidadorActa`   | Igual que Error1: aritmética pura.                                   |
| Error3  | `application/use_cases/...`       | Requiere consultar el repositorio para saber si el acta existe.       |
| Error4  | `application/use_cases/...`       | Requiere consultar el repositorio (idempotencia por `id_acta`).      |

Esta separación es importante porque Error1 y Error2 se prueban con tests unitarios de dominio (sin BD), mientras que Error3 y Error4 requieren un fake repository en tests unitarios o BD real en integración.

## Estructura de `ValidadorActa`

```python
# domain/services/validador_acta.py
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.exceptions import ErroresDeValidacionException

class ValidadorActa:
    """Valida Error1 y Error2 sobre una entity ActaOficial.

    No tiene acceso a BD. Las reglas son aritméticas puras.
    """

    def validar(self, acta: ActaOficial) -> None:
        errores: list[str] = []
        self._validar_error1(acta, errores)
        self._validar_error2(acta, errores)
        if errores:
            raise ErroresDeValidacionException(errores)

    def _validar_error1(self, a: ActaOficial, errores: list[str]) -> None:
        diferencia = a.habilitados - (a.anfora + a.no_usadas)
        if diferencia != 0:
            signo = "+" if diferencia > 0 else "-"
            errores.append(
                f"Son {a.habilitados} ciudadanos, hay {a.anfora} papeletas "
                f"en el ánfora y {a.no_usadas} papeletas no usadas, "
                f"hay una diferencia de {signo}{abs(diferencia)} papeletas"
            )

    def _validar_error2(self, a: ActaOficial, errores: list[str]) -> None:
        validos = a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4
        total_votos = validos + a.blancos + a.nulos
        diferencia = total_votos - a.anfora
        if diferencia != 0 or validos + a.blancos != a.anfora - a.nulos:
            signo = "+" if diferencia > 0 else "-"
            errores.append(
                f"Son {validos} votos por partidos, {a.blancos} votos blancos "
                f"y {a.nulos} votos nulos no inciden con la cantidad de "
                f"boletas en el ánfora {signo}{abs(diferencia)}"
            )
```

`validar()` acumula todos los errores antes de lanzar la excepción. Esto permite al cliente HTTP recibir TODOS los problemas del acta en una sola respuesta 422, no uno a uno.

## Error3 y Error4 en el use case

```python
# application/use_cases/registrar_recuento_use_case.py
class RegistrarRecuentoUseCase:
    async def execute(self, dto: RegistrarRecuentoDTO) -> ActaOficial:
        # ERROR4: idempotencia
        if await self._repo.exists(dto.id_acta):
            raise ActaYaProcesadaException(dto.codigo_acta)

        acta = ActaOficial.from_dto(dto)
        # ERROR1 + ERROR2 vía validador de dominio
        self._validador.validar(acta)

        await self._repo.save(acta)
        return acta
```

Error3 aparece en use cases de consulta o de actualización, no en el de registro. Ejemplo:

```python
# application/use_cases/consultar_acta_use_case.py
class ConsultarActaUseCase:
    async def execute(self, codigo_acta: str) -> ActaOficial:
        acta = await self._repo.get_by_codigo(codigo_acta)
        if acta is None:
            raise ActaNoExisteException(codigo_acta)
        return acta
```

## Ground truth: acta `1010200001001`

Acta de referencia para tests. Datos del enunciado del docente:

| Campo            | Valor                  |
|------------------|------------------------|
| `codigo_acta`    | `1010200001001`        |
| `habilitados`    | 877                    |
| `anfora`         | 788                    |
| `no_usadas`      | 89                     |
| Suma de control  | 788 + 89 = 877 ✓       |

Verificación manual:

```
ERROR1: 877 = 788 + 89  →  diferencia = 0  →  PASA
```

Para Error2, los votos de cada candidato + blancos + nulos deben sumar 788 (la cantidad en el ánfora), y los validos (p1+p2+p3+p4) más blancos deben encajar con `anfora - nulos`. Los valores específicos de votos_pN, blancos y nulos del acta real se cargan en `tests/fixtures/acta_1010200001001.json`.

Esta acta se usa en:

- Test unitario de `ValidadorActa.validar()` con valores correctos (debe NO lanzar).
- Test unitario con `anfora` modificado a 787 (debe lanzar Error1).
- Test unitario con `nulos` modificado para romper Error2.
- Test de integración POST `/api/v1/oficial/recuento` con la fixture completa.

## Prueba rápida con cada error

Casos para tests unitarios (`tests/unit/domain/test_validador_acta.py`):

| Caso                            | habilitados | anfora | no_usadas | Error esperado |
|---------------------------------|-------------|--------|-----------|----------------|
| Acta consistente                | 877         | 788    | 89        | (ninguno)      |
| Faltan papeletas                | 877         | 787    | 89        | Error1 con `-1` |
| Sobran papeletas                | 877         | 789    | 89        | Error1 con `+1` |
| Inconsistencia en válidos       | 877         | 788    | 89        | Error2 (variando votos) |

## Para detalles técnicos completos

Ver la skill `clean-architecture-rules` para el patrón de excepciones de dominio. Ver `07-testing-strategy.md` para cómo testear cada regla.
