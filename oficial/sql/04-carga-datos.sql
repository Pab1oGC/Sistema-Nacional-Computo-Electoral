-- ============================================================
-- 04-carga-datos.sql
-- Carga inicial de catálogos en oficial.*
--
-- Idempotente: usa ON CONFLICT DO NOTHING en todos los INSERT.
-- Los CSVs se cargan vía temp tables para poder aplicar ON CONFLICT
-- y para mapear nombres de columna del CSV al schema relacional.
--
-- WARNING — Bug del Excel del docente (CLAUDE.md sec 8):
-- En la hoja DistribucionTerritorial, las columnas "Municipio" y
-- "Provincia" están INVERTIDAS. Los CSVs generados por
-- exportar_excel_a_csv.py preservan ese bug. En este SQL invertimos
-- el mapeo en el INSERT a oficial.municipio para que la tabla quede
-- semánticamente correcta:
--   columna BD nombre     ← columna CSV "Provincia" (= municipio real)
--   columna BD provincia  ← columna CSV "Municipio" (= provincia real)
--
-- Los CSVs deben estar montados en /var/lib/postgresql/csv/ en el
-- container oficial_master (volumen ./data:/var/lib/postgresql/csv:ro).
-- Filenames esperados:
--   - data_distribucionterritorial.csv  (340 filas → oficial.municipio)
--   - data_recintoselectorales.csv      (537 filas → oficial.recinto)
--   - data_actasimpresas.csv            (5396 filas → oficial.mesa)
-- ============================================================

-- ─── 1. departamento (9 filas hardcoded) ───────────────────
INSERT INTO oficial.departamento (codigo, nombre) VALUES
    (1, 'Chuquisaca'),
    (2, 'La Paz'),
    (3, 'Cochabamba'),
    (4, 'Oruro'),
    (5, 'Potosí'),
    (6, 'Tarija'),
    (7, 'Santa Cruz'),
    (8, 'Beni'),
    (9, 'Pando')
ON CONFLICT (codigo) DO NOTHING;

-- ─── 2. partido (4 filas hardcoded, alineadas con seed RRV) ─
-- Colores tomados del seed bdd/init/03-seed.js del team lider para
-- que el dashboard renderice los mismos colores en TREP y Oficial.
INSERT INTO oficial.partido
    (id_partido, sigla_candidato, nombre_candidato, sigla_partido, color_hex, orden_papeleta)
VALUES
    (1, 'P1', 'Daenerys Targaryen', 'MAS-ISP', '#003087', 1),
    (2, 'P2', 'Sansa Stark',        'CC',      '#E63946', 2),
    (3, 'P3', 'Robert Baratheon',   'Creemos', '#F4A261', 3),
    (4, 'P4', 'Tyrion Lannister',   'APB',     '#2A9D8F', 4)
ON CONFLICT (id_partido) DO NOTHING;

-- ─── 3. municipio (340 filas) ──────────────────────────────
-- CSV header: CodigoTerritorial,Departamento,Municipio,Provincia
-- Bug del Excel: header "Municipio" tiene PROVINCIAS reales,
-- header "Provincia" tiene MUNICIPIOS reales → invertimos en el
-- INSERT.
-- "Departamento" en el CSV es un NOMBRE (no codigo); se resuelve a
-- INTEGER vía JOIN con oficial.departamento.

CREATE TEMP TABLE _municipio_raw (
    codigo_territorial    VARCHAR(10),    -- CSV: "CodigoTerritorial"
    departamento_nombre   VARCHAR(60),    -- CSV: "Departamento" (e.g. "Chuquisaca")
    columna_municipio     VARCHAR(120),   -- CSV header "Municipio"  (= provincia REAL)
    columna_provincia     VARCHAR(120)    -- CSV header "Provincia"  (= municipio REAL)
);

\copy _municipio_raw FROM '/var/lib/postgresql/csv/data_distribucionterritorial.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',');

INSERT INTO oficial.municipio (codigo, nombre, provincia, codigo_departamento)
SELECT
    (raw.codigo_territorial::NUMERIC::INTEGER)::TEXT,  -- "10102.0" → 10102 → "10102"
    raw.columna_provincia AS nombre,         -- ← INVERSIÓN
    raw.columna_municipio AS provincia,      -- ← INVERSIÓN
    d.codigo                                  -- JOIN: nombre depto → codigo INTEGER
FROM _municipio_raw raw
JOIN oficial.departamento d ON d.nombre = raw.departamento_nombre
ON CONFLICT (codigo) DO NOTHING;

DROP TABLE _municipio_raw;

-- ─── 4. recinto (537 filas) ────────────────────────────────
-- CSV header: recintoCode,CodigoTerritorial,CodigoRecinto,RecintoNombre,RecintoDireccion,NumMesas
-- 6 columnas. Numéricos vienen como float strings ("10102.0", "1010200001.0",
-- "9.0"); cargamos como TEXT y casteamos en el INSERT con
-- ::NUMERIC::TIPO_FINAL para limpiar el ".0" trailing.
-- recintoCode (numeración secuencial local del Excel) → descartado.
-- NumMesas → descartado (deriva de COUNT(*) sobre oficial.mesa).
-- CodigoTerritorial → codigo_municipio (FK VARCHAR(10) en oficial.municipio).
-- CodigoRecinto → codigo_recinto INTEGER (PK).

CREATE TEMP TABLE _recinto_raw (
    recinto_code         TEXT,    -- CSV: "recintoCode" (descartado)
    codigo_territorial   TEXT,    -- CSV: "CodigoTerritorial" → codigo_municipio (VARCHAR(10))
    codigo_recinto       TEXT,    -- CSV: "CodigoRecinto" → INTEGER
    recinto_nombre       TEXT,    -- CSV: "RecintoNombre"
    recinto_direccion    TEXT,    -- CSV: "RecintoDireccion"
    num_mesas            TEXT     -- CSV: "NumMesas" (descartado)
);

\copy _recinto_raw FROM '/var/lib/postgresql/csv/data_recintoselectorales.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',');

INSERT INTO oficial.recinto (codigo_recinto, nombre, direccion, codigo_municipio)
SELECT
    codigo_recinto::NUMERIC::BIGINT,                        -- "9050305394.0" → 9050305394 (excede INTEGER)
    recinto_nombre,
    recinto_direccion,
    (codigo_territorial::NUMERIC::INTEGER)::TEXT            -- "10102.0" → 10102 → "10102"
FROM _recinto_raw
ON CONFLICT (codigo_recinto) DO NOTHING;

DROP TABLE _recinto_raw;

-- ─── 5. mesa (5396 filas) ──────────────────────────────────
-- CSV header: CodigoRecinto,CodigoActa,NroMesa,VotantesHabilitados
-- 4 columnas (NO hay CodigoTerritorial en este CSV; deriva de recinto).
-- Todos los numéricos vienen como float strings → cargamos TEXT y
-- casteamos al insertar.
-- CodigoActa (13 dígitos) → codigo_mesa BIGINT (PK).
-- CodigoRecinto (10 dígitos, hasta ~9 mil millones) → codigo_recinto BIGINT (FK).
-- VotantesHabilitados → cantidad_habilitada INTEGER.

CREATE TEMP TABLE _mesa_raw (
    codigo_recinto        TEXT,     -- CSV: "CodigoRecinto" → BIGINT
    codigo_acta           TEXT,     -- CSV: "CodigoActa" (13 dígitos) → codigo_mesa BIGINT
    nro_mesa              TEXT,     -- CSV: "NroMesa" → INTEGER
    votantes_habilitados  TEXT      -- CSV: "VotantesHabilitados" → cantidad_habilitada INTEGER
);

\copy _mesa_raw FROM '/var/lib/postgresql/csv/data_actasimpresas.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Estrategia "filtrar e isolar": solo cargamos mesas con CodigoRecinto
-- que existe en oficial.recinto. El CSV del docente trae algunas filas
-- con CodigoRecinto mal tipeado (5 dígitos en lugar de 10, parecen
-- copias del CodigoTerritorial). NO inventamos: rechazamos y auditamos.
INSERT INTO oficial.mesa (codigo_mesa, codigo_recinto, nro_mesa, cantidad_habilitada)
SELECT
    m.codigo_acta::NUMERIC::BIGINT           AS codigo_mesa,        -- "1010200001001.0" → 1010200001001
    m.codigo_recinto::NUMERIC::BIGINT        AS codigo_recinto,     -- "9050305394.0" → 9050305394
    m.nro_mesa::NUMERIC::INTEGER             AS nro_mesa,           -- "1.0" → 1
    m.votantes_habilitados::NUMERIC::INTEGER AS cantidad_habilitada -- "877.0" → 877
FROM _mesa_raw m
INNER JOIN oficial.recinto r
    ON r.codigo_recinto = m.codigo_recinto::NUMERIC::BIGINT
ON CONFLICT (codigo_mesa) DO NOTHING;

-- Mesas RECHAZADAS (FK inválida) → cuarentena para audit.
INSERT INTO oficial.actas_descartadas (
    codigo_recinto_csv, codigo_acta_csv, nro_mesa_csv, razon
)
SELECT
    m.codigo_recinto,
    m.codigo_acta,
    m.nro_mesa,
    'CodigoRecinto no existe en catálogo oficial.recinto (posible error de transcripción)'
FROM _mesa_raw m
LEFT JOIN oficial.recinto r
    ON r.codigo_recinto = m.codigo_recinto::NUMERIC::BIGINT
WHERE r.codigo_recinto IS NULL;

DROP TABLE _mesa_raw;

-- ─── Verificación de carga ─────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Mesas cargadas: %',
        (SELECT COUNT(*) FROM oficial.mesa);
    RAISE NOTICE 'Mesas DESCARTADAS por FK inválida: %',
        (SELECT COUNT(*) FROM oficial.actas_descartadas);
END
$$;

SELECT 'departamento'      AS tabla, COUNT(*) AS filas, 9    AS esperado FROM oficial.departamento
UNION ALL SELECT 'municipio',         COUNT(*), 340  FROM oficial.municipio
UNION ALL SELECT 'recinto',           COUNT(*), 537  FROM oficial.recinto
UNION ALL SELECT 'mesa',              COUNT(*), 5396 FROM oficial.mesa
UNION ALL SELECT 'partido',           COUNT(*), 4    FROM oficial.partido
UNION ALL SELECT 'actas_descartadas', COUNT(*), NULL FROM oficial.actas_descartadas
ORDER BY tabla;
