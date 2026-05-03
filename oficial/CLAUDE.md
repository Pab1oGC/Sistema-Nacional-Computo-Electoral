# CLAUDE.md - Cómputo Oficial

Este archivo guía a Claude Code cuando trabaja dentro de `oficial/`. Las
decisiones aquí descritas son vinculantes y no deben reabrirse sin actualizar
explícitamente este documento.

## 1. Mi rol en el equipo

Soy responsable del módulo de Cómputo Oficial dentro del Sistema Nacional de
Cómputo Electoral 2025. Responsabilidades concretas:

1. Cluster PostgreSQL en replicación espejo (Mirror): master + réplica
   síncrona con recuperación automática.
2. Endpoint `POST /api/v1/oficial/recuento` que recibe transcripciones
   validadas (vía n8n o vía formulario web manual).
3. Endpoints `GET /api/v1/oficial/*` simétricos a los del RRV para que el
   dashboard pueda comparar TREP vs Oficial lado a lado.
4. Las 4 reglas de validación obligatorias del enunciado (Error1 a Error4).
5. Workflow n8n que automatiza la lectura del CSV maestro y autocompleta el
   formulario web del oficial.
6. Formulario web manual como alternativa cuando n8n falla.
7. Conexión del dashboard general (que hoy usa `mockData.ts`) a mis APIs
   reales. Yo me hago cargo de este enlace.
8. Dashboard propio (separado del general) para mi defensa individual.
9. Defensa individual EN INGLÉS (30 pts).

Nota: la documentación técnica de 2 páginas ya fue redactada por el equipo.
Mi participación en ese entregable se limita a aportar capturas de mi módulo
si son requeridas, pero NO redacto ni edito el documento.

## 2. Lo que NO me toca

- RRV (Recuento Rápido): team lider con MongoDB + Kafka + MinIO.
- Salto de llave de identidad: el team lider lo implementa aparte de su
  Replica Set de Mongo.
- App móvil: Pablo (React Native + Expo).
- Componentes de UI del dashboard general (`BoliviaMap`, `PartyResults`,
  etc.): ya existen, yo solo los conecto a mis APIs reales.

## 3. Decisiones arquitectónicas (NO reabrir)

Stack:

- Python 3.11 + FastAPI 0.115 (mismo que el RRV del team lider).
- PostgreSQL 16 + asyncpg + SQLAlchemy 2.0 async.
- Alembic para migraciones.
- Pydantic 2 para schemas HTTP.
- n8n para automatización CSV a API.
- Dashboard propio: React 18 + Vite + TypeScript (mismo stack del general).

Replicación:

- PostgreSQL Streaming Replication SÍNCRONO.
- `synchronous_commit=on`, `synchronous_standby_names='oficial_replica'`.
- Failover manual con `pg_promote()`. Patroni se menciona en la documentación
  pero NO se implementa (decisión consciente por simplicidad).

Arquitectura del backend:

- Clean Architecture con UN solo bounded context (`recuento_oficial`).
- Capas: `domain` / `application` / `infrastructure` / `presentation`.
- Tres tipos de modelos:
  - Entity (domain, Python puro).
  - ORM (infrastructure, SQLAlchemy con `Mapped[]`).
  - Schema (presentation, Pydantic).
- Repositorios como `Protocol` en domain, implementación SQLAlchemy en infra.
- Use cases con `__init__` recibiendo dependencias y método único `execute()`.
- DI con FastAPI nativo: `Depends` + `lru_cache` (sin librerías externas).

## 4. Estructura de mi carpeta

```
oficial/
├── CLAUDE.md (este archivo)
├── README.md
├── docs/
│   ├── architecture/        (specs vinculantes 01 a 07)
│   ├── decisions.md         (ADRs para defensa)
│   └── defense-script-en.md (después)
├── docker-compose.oficial.yml
├── .claude/
│   ├── commands/            (slash commands)
│   └── skills/              (skills auto-cargadas)
├── sql/
│   ├── 01-schema.sql
│   ├── 02-replication-master.conf
│   ├── 03-replication-replica.sh
│   ├── 04-carga-datos.sql
│   └── 05-consultas.sql
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── .env.example
│   ├── alembic/versions/
│   ├── src/
│   │   ├── main.py
│   │   ├── composition_root.py
│   │   ├── shared/
│   │   │   ├── domain/value_objects/
│   │   │   └── infrastructure/database/
│   │   └── recuento_oficial/
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   ├── repositories/
│   │       │   ├── services/
│   │       │   └── exceptions.py
│   │       ├── application/
│   │       │   ├── use_cases/
│   │       │   └── dtos/
│   │       ├── infrastructure/
│   │       │   └── persistence/{models, mappers, repositories}
│   │       └── presentation/
│   │           ├── api/v1/
│   │           └── schemas/
│   └── tests/
│       ├── unit/
│       └── integration/
├── n8n/
│   ├── workflow-csv-a-formulario.json
│   └── README.md
├── data/
│   ├── csv-master.csv
│   └── data_*.csv (catálogos para sembrar PostgreSQL)
├── dashboard-oficial/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
└── scripts/
    ├── levantar.sh
    ├── apagar.sh
    ├── cargar-datos.sh
    ├── demo-failover.sh
    └── conectar-dashboard-general.sh
```

## 5. Configuración Docker

Red Docker: `rrv-net` (compartida con el team lider, NO crear otra).

Mapeo de puertos al host (asignados a mí, verificados que no chocan):

| Servicio          | Host  | Container | Notas                         |
|-------------------|-------|-----------|-------------------------------|
| `oficial_api`     | 8001  | 8000      | FastAPI                       |
| `oficial_master`  | 5432  | 5432      | PostgreSQL primario           |
| `oficial_replica` | 5433  | 5432      | PostgreSQL standby síncrono   |
| `n8n`             | 5678  | 5678      | n8n                           |
| `oficial_dashboard` | 5174 | 5173     | Mi dashboard propio (Vite)    |

Aclaración sobre el puerto 8000:

- DENTRO de la red Docker `rrv-net`, todos los containers FastAPI usan 8000
  internamente (es el puerto por defecto). No hay choque porque cada
  container tiene su propia IP virtual.
- En el MAPEO al host, yo publico `8001:8000`. El team lider probablemente
  publica `8000:8000`, pero esto es ASUMIDO, NO VERIFICADO. Si resulta que
  él usa otro puerto del host, no afecta mi configuración.
- El dashboard hace `fetch` usando hostnames de Docker (`oficial_api`,
  `rrv_api`), no `localhost`. Así no dependemos del mapeo del host.

Puertos del team lider que NO debo tocar:

- `27017`, `27018`, `27019`: MongoDB nodos del Replica Set.
- `9094`: Kafka.
- `9000`, `9001`: MinIO API y Console.
- `8000`: su API (asumido, no verificado).
- `5173`: dashboard general.

## 6. Endpoints simétricos al RRV

El RRV expone (referencia, no modificable por mí):

- `GET /api/v1/resultados`
- `GET /api/v1/avance`
- `GET /api/v1/actas`
- `GET /api/v1/inconsistencias`
- `GET /api/v1/candidatos`
- `POST /api/v1/actas/foto`, `POST /api/v1/actas/sms`

Yo expongo (mismo formato JSON, prefijo `oficial`):

- `POST /api/v1/oficial/recuento` (entrada principal: n8n y formulario).
- `GET  /api/v1/oficial/resultados` (mismo schema que el RRV).
- `GET  /api/v1/oficial/avance` (mismo schema).
- `GET  /api/v1/oficial/actas` (mismo schema, con filtros).
- `GET  /api/v1/oficial/inconsistencias` (con tipo Error1 a Error4).
- `GET  /api/v1/oficial/candidatos`.
- `GET  /api/v1/oficial/replicacion/estado` (específico mío, vista técnica).
- `GET  /health`.

Importante: los modelos Pydantic de respuesta deben tener EXACTAMENTE los
mismos campos que el RRV para que el dashboard haga merge sin transformación.
Cuando implementes los schemas, lee los del RRV en `rrv/api/models/` y
`rrv/api/routes/consultas.py` y replica los nombres de campo.

Excepción de naming: el dashboard general usa `tipo: 'FORM'` para diferenciar
mis actas de las del RRV (`'FOTO' | 'SMS'`). Mis endpoints deben devolver
`tipo: 'FORM'`.

## 7. Las 4 reglas de validación obligatorias

Estas son del enunciado del docente. Mensajes literales obligatorios:

ERROR1: `habilitados = ánfora + no_usadas`

> "Son XXX ciudadanos, hay YYY papeletas en el ánfora y ZZ papeletas no
> usadas, hay una diferencia de +/-N papeletas"

ERROR2: `ánfora = p1 + p2 + p3 + p4 + blancos + nulos`

> "Son XXX votos por partidos, YYY votos blancos y ZZZ votos nulos no
> inciden con la cantidad de boletas en el ánfora +/-N"

Nota sobre terminología "votos válidos": en el Excel del docente, la columna
`VotosValidos` contiene SOLO la suma de votos por partidos (p1+p2+p3+p4), y
los blancos se contabilizan aparte. El validador chequea directamente la
ecuación de arriba sin usar el concepto intermedio "válidos". Esta
convención coincide con el formato real del acta OEP boliviana.

ERROR3: el acta no existe en la BDD

> "El acta XXX no se encuentra en la BDD TREP/OFICIAL"

ERROR4: el acta ya fue procesada (idempotencia)

> "El acta XXX ya ha sido procesada en la BDD TREP/OFICIAL"

Ubicación en el código:

- Error1 y Error2 se validan en `domain/services/ValidadorActa` (puro, sin BD).
- Error3 y Error4 se validan en el use case porque requieren acceso al repo.

## 8. Datos del dominio

Universo acotado al Excel del docente para esta práctica:

- 9 departamentos.
- 340 municipios (de la hoja `DistribucionTerritorial` del Excel).
- 537 recintos electorales.
- 5396 mesas (= 5396 actas a procesar).

Las provincias se infieren del cruce departamento-municipio. No hay un
catálogo explícito de provincias en el Excel; el schema `oficial.provincia`
se puebla con los valores `DISTINCT` que aparezcan al cargar municipios.

Nota sobre `total_mesas`:

- Mis endpoints reportan `total_mesas: 5396`.
- El seed del team lider (`bdd/init/03-seed.js`) inicializa
  `vista_actas_estado.total_mesas = 35000` como placeholder genérico de
  "Bolivia nacional", NO del universo de la práctica.
- Si el dashboard general muestra desfase entre TREP (35000) y Oficial
  (5396), eso es un bug del seed del team lider. NO es mi problema corregirlo
  en su código; mi obligación es reportar 5396 que es el número real.

4 candidatos (orden papeleta del acta real, alineado con el seed del team
lider para que los colores coincidan en TREP y Oficial):

| Sigla | Nombre              | Partido  | Color hex | Orden |
|-------|---------------------|----------|-----------|-------|
| P1    | Daenerys Targaryen  | MAS-ISP  | `#003087` | 1     |
| P2    | Sansa Stark         | CC       | `#E63946` | 2     |
| P3    | Robert Baratheon    | Creemos  | `#F4A261` | 3     |
| P4    | Tyrion Lannister    | APB      | `#2A9D8F` | 4     |

Esquema de la tabla `oficial.partido`:

- `id_partido` (PK)
- `sigla_candidato` (P1, P2, P3, P4)
- `nombre_candidato`
- `sigla_partido` (MAS-ISP, CC, Creemos, APB)
- `color_hex`
- `orden_papeleta`

La entity `Partido` en `domain/entities/` y los schemas Pydantic de respuesta
deben incluir TODOS estos campos. El team lider expone `sigla` en su payload
de `/candidatos`, yo debo exponer `sigla_partido` con el mismo nombre que
use el dashboard al consumir ambas APIs.

WARNING CONOCIDO DEL EXCEL DEL DOCENTE:

En la hoja `DistribucionTerritorial` del Excel del docente, las columnas
"Municipio" y "Provincia" están INVERTIDAS en el header. Los valores reales
son:

- Columna etiquetada "Municipio": contiene PROVINCIAS (Oropeza, Azurduy, etc.).
- Columna etiquetada "Provincia": contiene MUNICIPIOS (Sucre, Yotala, etc.).

Verificación geográfica: Sucre es la capital constitucional de Bolivia, es
un municipio. Oropeza es la provincia donde está Sucre. El Excel los tiene
al revés.

Cuando generes `sql/04-carga-datos.sql`, INVIERTE el mapeo en los `INSERT`
para que mi tabla `oficial.distribucion_territorial` quede semánticamente
correcta:

- `provincia` <- valor de la columna del Excel etiquetada "Municipio".
- `municipio` <- valor de la columna del Excel etiquetada "Provincia".

Importante: el seed del team lider (`bdd/init/03-seed.js`) replica este bug
del Excel sin corregirlo (tiene `municipio: "Oropeza", provincia: "Sucre"`).
Mi tabla NO debe replicar el bug. Mis endpoints devolverán los nombres
correctos. Si esto produce diferencias visibles entre TREP y Oficial en el
dashboard, es un bug aguas arriba del team lider.

## 9. Reglas estrictas durante el desarrollo

PROHIBIDO:

- Modificar archivos fuera de `oficial/` EXCEPTO los siguientes casos
  permitidos:
  - Editar `dashboard/src/data/mockData.ts` y archivos relacionados para
    conectar las APIs reales en lugar de los mocks.
  - Agregar componentes nuevos en `dashboard/src/components/` específicos
    del módulo Oficial (gráficas, tablas, indicadores) cuando sea necesario
    para defender mi parte.
  - NO modificar componentes existentes del team lider sin extrema
    justificación.
  - NO modificar la rama de RRV ni la app móvil bajo ningún concepto.
- Importar SQLAlchemy, FastAPI, Pydantic en `domain/`.
- Importar entre capas saltando el orden
  `domain` -> `application` -> `infrastructure` -> `presentation`.
- Usar MongoDB en cualquier parte de mi código.
- Cambiar puertos sin actualizar este `CLAUDE.md`.
- Asumir que algo del team lider funciona, siempre verificar primero.

PERMITIDO:

- Leer archivos del repo del team lider para entender su contrato.
- Agregar servicios al `docker-compose.oficial.yml`.
- Crear archivos en mi carpeta `oficial/`.
- Levantar mi módulo independientemente del de ellos.
- Editar el dashboard general (`dashboard/`) para integrar mis APIs y
  agregar mis gráficas, respetando los componentes existentes del team
  lider.

## 10. Entregables que valen puntos

- 50 pts compartidos: implementación funcional RRV (team lider) + Cómputo
  Oficial (yo). La documentación técnica de 2 páginas y las capturas las
  coordina el equipo, no es mi entregable directo.
- 20 pts compartidos: dashboard con métricas (general + mi propio para
  defender).
- 30 pts SOLO MÍOS: defensa individual EN INGLÉS, preguntas técnicas.
- 15 pts SOLO MÍOS: automatización n8n con CSV maestro.
- 15 pts: app móvil (Pablo).

Mi contribución directa a puntos: ~95 de 130. Por eso este módulo es
crítico, no es accesorio.

## 11. Próximos pasos

1. Crear `.claude/commands/` y `.claude/skills/`.
2. Crear `docs/architecture/` con specs vinculantes.
3. Generar el backend (Clean Architecture).
4. Generar SQL de schema y replicación.
5. Configurar `docker-compose.oficial.yml` integrado a la red `rrv-net`.
6. Implementar workflow n8n.
7. Construir dashboard propio.
8. Conectar dashboard general (cambiar `mockData` por API).
9. Tests.
10. Guion de defensa en inglés.
