# Workflow n8n: CSV maestro → API Cómputo Oficial

Automatización de la carga de `data/csv-master.csv` (5396 actas) hacia el endpoint `POST /api/v1/oficial/recuento`. Diseño documentado en `oficial/docs/architecture/06-n8n-workflow.md` y `oficial/.claude/skills/n8n-csv-to-api-pattern/SKILL.md`.

## Archivos

| Archivo | Rol |
|---|---|
| `workflow-csv-a-formulario.json` | Workflow exportado, importable en n8n. 13 nodos. |
| `output/` | Directorio writable montado al container n8n como `/output`. Aquí escribe `n8n-resultados.json`. |
| `output/.gitignore` | Ignora todo el contenido de `output/` (los resultados son ephemeral). |
| `test-manual.http` | Pruebas manuales del endpoint sin n8n (VS Code REST Client). |
| `README.md` | Este archivo. |

## Estructura del workflow (13 nodos)

```
Manual Trigger ─┐
                ├─→ Configuración (Set) ─→ Leer csv-master ─→ Parsear CSV
Schedule (5m) ─┘
   ─→ Validar y construir body (Code) ─→ Lotes de 50 ─→ POST /recuento
   ─→ ¿Status 2xx? (IF)
        ├─ True  → Resumen exitosos ─┐
        └─ False → Resumen rechazados ┴─→ Generar reporte (Code+Buffer)
                                            ─→ Escribir n8n-resultados.json
```

## Antes de importar

1. El cluster `oficial_master` y `oficial_replica` deben estar levantados (`docker compose -f docker-compose.oficial.yml up -d oficial_master oficial_replica`).
2. La API `oficial_api` debe estar arriba (`docker compose -f docker-compose.oficial.yml up -d oficial_api`). El workflow le hace POST.
3. El servicio `n8n` debe estar arriba (`docker compose -f docker-compose.oficial.yml up -d n8n`).

Verificá que los 4 servicios estén healthy con:

```bash
docker compose -f docker-compose.oficial.yml ps
```

## Importar el workflow

1. Abrí n8n en el navegador: `http://localhost:5678`.
2. Login con las credenciales del compose (default: usuario `admin`, password `admin_2025`; pueden cambiarse vía env vars `N8N_USER` y `N8N_PASSWORD`).
3. En la barra superior izquierda, click en `Workflows` → `Add workflow` (botón `+`).
4. Click en el menú `...` arriba a la derecha → `Import from File`.
5. Seleccioná `oficial/n8n/workflow-csv-a-formulario.json`.
6. n8n abre el workflow con los 13 nodos. Click en `Save` (Ctrl+S).

El workflow se importa **inactivo** (toggle `Active` apagado) y con el `Schedule Trigger` deshabilitado.

## Correr Manual (para demo)

1. Abrí el workflow en n8n.
2. Click en `Execute Workflow` (botón verde abajo a la izquierda).
3. n8n ejecuta el flujo desde el `Manual Trigger`. Cada nodo se ilumina al ejecutarse.
4. Esperá ~2 a 4 minutos (depende del rate de la API y el tamaño del CSV).
5. Al terminar, abrí el archivo `oficial/n8n/output/n8n-resultados.json` en tu editor.

## Activar el Schedule Trigger (5 min)

1. En el workflow abierto, click sobre el nodo `Schedule Trigger (5min)`.
2. En el panel lateral, desactivá el toggle `Disabled` (queda activo).
3. Activá el workflow completo con el toggle `Active` arriba a la derecha.
4. n8n va a disparar el flujo cada 5 minutos automáticamente.

Para desactivar: toggle `Active` off, o `Disabled` on en el nodo Schedule.

## Estructura del output (`output/n8n-resultados.json`)

```json
{
  "timestamp": "2026-05-03T18:42:00.000Z",
  "workflow_run_id": "abc123",
  "total": 5396,
  "ok": 5350,
  "rechazados": 46,
  "por_categoria": {
    "OK": 5350,
    "INVALIDO_PRE_API": 12,
    "ERROR_REFERENCIAL": 30,
    "ERROR_VALIDACION_ERROR1": 3,
    "DUPLICADO_IDEMPOTENTE": 1
  },
  "items": [
    { "codigo_acta": "1010200001001", "status": "OK", "_categoria_error": "OK", "_csv_row_number": 2, "statusCode": 201 },
    { "codigo_acta": "1010200001002", "status": "ERROR", "_categoria_error": "ERROR_VALIDACION_ERROR1", "_csv_row_number": 3, "statusCode": 422, "razon_api": "...", "razones_pre_api": "[]" },
    ...
  ]
}
```

### Categorías posibles en `_categoria_error`

| Categoría | Significado |
|---|---|
| `OK` | Acta procesada y persistida correctamente (201). |
| `INVALIDO_PRE_API` | El Code Node `Validar y construir body` detectó datos malformados antes del POST (CodigoActa no parseable, columnas faltantes, etc.). |
| `DUPLICADO_IDEMPOTENTE` | Error4 (acta ya procesada en una corrida anterior). HTTP 409. Esperado en re-ejecuciones del workflow. |
| `ERROR_REFERENCIAL` | Error3 (mesa no existe en el catálogo `oficial.mesa`). HTTP 404. Coincide con las actas filtradas durante la carga inicial vía `actas_descartadas`. |
| `ERROR_VALIDACION_ERROR1` | Error1 (papeletas: `habilitados ≠ ánfora + no_usadas`). HTTP 422. |
| `ERROR_VALIDACION_ERROR2` | Error2 (votos: `ánfora ≠ p1+p2+p3+p4 + blancos + nulos`). HTTP 422. |
| `ERROR_HTTP_SERVIDOR` | 5xx del API (BD caída, timeout, etc.). |
| `ERROR_OTRO` | Cualquier otro 4xx no clasificado arriba. |

Nota: si Error1 y Error2 disparan simultáneamente (~raro), la categoría reportada es `ERROR_VALIDACION_ERROR1` por orden de evaluación de la expresión.

## Verificar que cargó (después de la corrida)

Conteo en la BD:

```bash
docker exec oficial_master psql -U oficial_writer -d oficial -c "SELECT COUNT(*) FROM oficial.acta_oficial;"
docker exec oficial_master psql -U oficial_writer -d oficial -c "SELECT tipo, COUNT(*) FROM oficial.log_inconsistencias GROUP BY tipo;"
```

Esperado:
- `acta_oficial` ≈ 5350 (5396 menos los que la BD ya tenía descartados como mesas inválidas, menos los Error1/Error2 detectados por la API).
- `log_inconsistencias` debe tener filas con `tipo='ERROR1'` y/o `'ERROR2'` para las actas inconsistentes.

## Precondiciones para que el workflow funcione

- El bind mount `./data:/data:ro` debe contener `csv-master.csv`. Lo verifica el Read File node.
- El bind mount `./n8n/output:/output` debe ser writable (RW). El compose lo configura así por defecto.
- La env var `API_URL_OFICIAL` ya está seteada en el compose. Si no estuviera, el Set "Configuración" usa el fallback `http://oficial_api:8000`.
- La env var `CSV_PATH` también, con fallback `/data/csv-master.csv`.

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Read File falla con "ENOENT" | `csv-master.csv` no está en `data/` | Generar el CSV con `exportar_excel_a_csv.py` antes de correr. |
| HTTP timeout en todos los items | `oficial_api` no arrancó o la BD no está healthy | `docker compose ps`, `docker logs oficial_api --tail 20`. |
| Todos los items 422 con `INVALIDO_PRE_API` | El header del CSV no matchea el parser | Revisar la primera línea de `csv-master.csv` y compararla con los nombres usados en `n06-validar` (`row.CodigoActa`, `row.P1`, etc.). |
| Write File falla con "EACCES" | Mount `output/` no es writable | Verificar que `docker-compose.oficial.yml` tiene `./n8n/output:/output` (sin `:ro`). |
| Resultados con `_categoria_error: 'DESCONOCIDO'` masivo | El IF no clasificó por statusCode | Confirmar que el HTTP Request tiene `fullResponse: true` (debe estar en el JSON). |

## Por qué este diseño (defensa)

- **Set "Configuración" centraliza paths y URLs.** Cambiar el endpoint o el batch size es una edición de un solo nodo.
- **Code Node "Validar y construir body" hace pre-validación local.** Aunque la API también valida, el pre-check ahorra round-trips para casos triviales (CodigoActa no parseable) y permite categorizar `INVALIDO_PRE_API` distinto de `ERROR_VALIDACION_ERROR1/2`.
- **Body separado de metadata.** El `body` que se POSTea al endpoint contiene SOLO los 15 campos del contrato Pydantic (`codigo_acta` como string, etc.). La metadata (`_invalid_local`, `_razones_pre_api`, `_csv_row_number`) viaja entre nodos n8n pero NO se envía al API. Principio de explicit contracts.
- **Aggregate + Write File separados.** El Code Node `Generar reporte` agrega + serializa a binary (con `Buffer.from(...)`); el Read/Write File node escribe a disco. Ningún `require('fs')`, respetamos el sandbox de n8n.
- **Continue On Fail + neverError.** El HTTP Request no aborta el workflow ante 4xx/5xx. Cada item se categoriza individualmente.
- **Categorización post-respuesta.** El Set "Resumen rechazados" usa una expresión ternaria que distingue 6 categorías de error con el statusCode + el body del API. La cuenta final por categoría está en `por_categoria` del reporte.

## Ver también

- Skill `n8n-csv-to-api-pattern` (`oficial/.claude/skills/n8n-csv-to-api-pattern/SKILL.md`) — el patrón general aplicado.
- Spec `06-n8n-workflow.md` (`oficial/docs/architecture/06-n8n-workflow.md`) — decisiones de diseño documentadas.
- Slash command `/n8n-importar` (`oficial/.claude/commands/n8n-importar.md`) — guía de import paso a paso para Claude Code.
