# 06 — Workflow n8n: CSV maestro → API

## Propósito

Automatización de la carga del CSV maestro (5396 actas) hacia el endpoint `POST /api/v1/oficial/recuento`. Este documento cubre las decisiones de diseño. Para configuración nodo-por-nodo con código JavaScript del Code Node, ver la skill `n8n-csv-to-api-pattern`.

## Diseño del workflow

8 nodos en orden:

```
[1] Trigger (Manual + Watch Folder)
      ↓
[2] Read Binary File   (csv-master.csv)
      ↓
[3] Move Binary Data   (binary → JSON string)
      ↓
[4] Code Node          (parse + validate)
      ↓
[5] Split In Batches   (50 filas, 1s entre lotes)
      ↓
[6] HTTP Request       (POST /api/v1/oficial/recuento)
      ↓
[7] IF Node            (status 2xx vs error)
      ↓                    ↓
   [8a] Set OK         [8b] Append a errores.csv
      ↓                    ↓
[9] Set Node final     (resumen ejecución)
```

## Por qué n8n y no un script Python

Decisión deliberada. n8n aporta valores que un script ad-hoc no:

1. **Visual auditability.** El docente puede revisar el flujo sin leer Python. Cada nodo es una decisión visible.
2. **Retry y dead-letter incorporados.** El nodo HTTP Request tiene retry on failure + backoff sin código adicional.
3. **Segregación de errores estructurada.** Un IF node por código HTTP separa OK / error sin lógica imperativa.
4. **Credenciales separadas del flujo.** n8n las guarda en su propio store, no aparecen en el JSON del workflow.
5. **Producto de producción, no script casero.** Para la defensa, "uso n8n" es un argumento de calidad operacional.

Trade-off aceptado: un servicio más en el `docker-compose.oficial.yml`. Para 5396 filas el overhead de n8n es insignificante.

## Manejo de errores

### Validación local (Code Node, antes del HTTP)

Filtros que fallan rápido y barato sin ir al API:

- `codigo_acta` debe matchear `/^\d{13}$/`.
- Campos numéricos (`codigo_mesa`, `votos_pN`, `blancos`, `nulos`, `habilitados`, `anfora`, `no_usadas`) deben parsear como int.

Las filas con errores locales se marcan con `_errors: [...]` y se redirigen al output de errores SIN hacer POST.

### Validación remota (API responde)

El API devuelve:

| HTTP | Significado                                                  |
|------|--------------------------------------------------------------|
| 201  | Acta registrada OK.                                          |
| 409  | Error4 (ya procesada). Idempotencia: re-correr no duplica.    |
| 422  | Error1 o Error2. Detail incluye los mensajes literales.       |
| 503  | BD no disponible. Retry automático en n8n debería cubrirlo.   |

### CSV de errores

Filas que fallan (local o remoto) se appendean a `oficial/data/errores.csv` con columnas:

```
codigo_acta, codigo_mesa, http_status, error_code, mensaje, timestamp
```

`error_code` se parsea del JSON de respuesta del API (`Error1`, `Error2`, `Error4`). Esto permite re-procesar después de corregir el CSV maestro.

## Rate limiting

50 filas por batch + 1 segundo de espera entre batches = ~50 requests/segundo. A ese ritmo, las 5396 actas tardan ~2 minutos en cargarse.

Por qué no más rápido: el master PostgreSQL hace fsync por commit (replicación síncrona), y cada commit cuesta ~10 ms. Un ritmo mucho mayor saturaría la cola WAL antes que ayudara.

Por qué no más lento: la demo se vuelve aburrida si tarda más de 3 minutos.

## Idempotencia end-to-end

Re-ejecutar el workflow no duplica registros gracias a Error4 (validación de `id_acta` único en el use case). Si el CSV maestro tiene una fila con el mismo `id_acta` que ya está en BD, el API devuelve 409 y n8n la apenda al CSV de errores con `error_code: Error4`.

## Variables de entorno

```
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=cambiame_2025
GENERIC_TIMEZONE=America/La_Paz
```

Configuradas en `oficial/n8n/.env`. NO commitear el `.env` con passwords reales (ya está en `.gitignore` por convención del repo).

## Networking

n8n llama al API por hostname Docker:

```
URL: http://oficial_api:8000/api/v1/oficial/recuento
```

NO usar `localhost` ni `127.0.0.1`: estamos dentro de la red `rrv-net`. Cada container tiene su propio loopback. El mapeo del puerto 8001 al host es solo para que el desarrollador (yo) acceda desde mi máquina.

## Importar/exportar el workflow

- **Exportar:** UI > workflow > menú `...` > `Download`. Guarda JSON en `oficial/n8n/workflow-csv-a-formulario.json`.
- **Importar:** UI > Settings > Import from File > seleccionar el JSON.

El comando `/n8n-importar` (en `.claude/commands/`) tiene la guía paso a paso para que un nuevo evaluador importe el workflow desde cero.

## Defensa en inglés (referencia)

Frases listas en la skill `defense-english-vocabulary` y la skill `n8n-csv-to-api-pattern`. Resumen del argumento:

> "We use n8n because it gives us four things a Python script doesn't: visual auditability, built-in retry with exponential backoff, error segregation by HTTP status code, and a credentials store separate from the workflow definition."

## Para detalles técnicos completos

Ver la skill `n8n-csv-to-api-pattern` (en `oficial/.claude/skills/n8n-csv-to-api-pattern/SKILL.md`). Tiene el código JavaScript del Code Node, configuración exacta del HTTP Request node, y el mapeo de campos al JSON body.
