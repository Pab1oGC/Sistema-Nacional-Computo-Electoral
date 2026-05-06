-- =====================================================================
-- 01-schema-v2.sql — Schema OFICIAL v2 (rama Alex_2.0)
-- =====================================================================
-- Cambios respecto a 01-schema.sql:
-- 1. NUEVA tabla oficial.provincia (112 entries reales).
-- 2. RESTRUCTURA de oficial.municipio: ahora 340 entries reales y
--    su FK apunta a provincia (antes apuntaba a departamento).
-- 3. NUEVO ENUM oficial.tipo_observacion_formal con 9 categorías
--    formales del docente.
-- 4. acta_oficial gana 2 columnas: observacion_formal (texto libre) y
--    tipo_observacion_formal (enum), ambas NULLABLE.
-- 5. log_inconsistencias.tipo CHECK añade 'INCONSISTENCIA_NUMERICA' para
--    auditar (sin descartar silenciosamente) actas con votos negativos.
-- 6. recinto.codigo_municipio ahora referencia a oficial.municipio (que
--    ahora son los municipios reales, no las provincias mal etiquetadas).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS oficial;
SET search_path TO oficial, public;

-- ──────────────────────────────────────────────────────────────────────
-- ROLES (idempotente). El entrypoint oficial de Postgres ya crea
-- oficial_writer (vía POSTGRES_USER), pero NO crea dashboard_ro ni
-- oficial_replicator. Sin estos dos, la réplica no puede hacer
-- pg_basebackup y el dashboard no puede leer en read-only.
-- ──────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_ro') THEN
        CREATE ROLE dashboard_ro LOGIN PASSWORD 'dash_2025';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oficial_replicator') THEN
        CREATE ROLE oficial_replicator REPLICATION LOGIN
            PASSWORD 'replica_2025';
    END IF;
END
$$;

-- Permisos para dashboard_ro: SELECT en tablas presentes y futuras del
-- schema oficial.
GRANT USAGE ON SCHEMA oficial TO dashboard_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA oficial
    GRANT SELECT ON TABLES TO dashboard_ro;

-- ──────────────────────────────────────────────────────────────────────
-- ENUM: tipos de observación formal del docente (9 categorías)
-- ──────────────────────────────────────────────────────────────────────
CREATE TYPE oficial.tipo_observacion_formal AS ENUM (
  'FALTA_DATOS_APERTURA_CIERRE',
  'MESA_LUGAR_DISTINTO',
  'USO_FORMULARIOS_NO_OFICIALES',
  'PAPELETAS_NO_AUTORIZADAS',
  'AUSENCIA_DELEGADOS',
  'FECHA_INCORRECTA',
  'ERRORES_TRANSCRIPCION',
  'FALTA_FIRMAS_HUELLAS',
  'INCONSISTENCIA_ARITMETICA'
);

-- ──────────────────────────────────────────────────────────────────────
-- Departamentos (9, igual que antes)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.departamento (
  codigo INTEGER PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

-- ──────────────────────────────────────────────────────────────────────
-- Provincia (NUEVO: 112 entries reales de Bolivia)
-- En el Excel estaban etiquetadas como "Municipio" col 2 de
-- DistribucionTerritorial (bug semántico del Excel del docente).
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.provincia (
  codigo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  codigo_departamento INTEGER NOT NULL REFERENCES oficial.departamento(codigo),
  UNIQUE (nombre, codigo_departamento)
);

CREATE INDEX idx_provincia_depto ON oficial.provincia(codigo_departamento);

-- ──────────────────────────────────────────────────────────────────────
-- Municipio (RESTRUCTURADO: 340 entries reales como Sucre, Yotala, …)
-- En el Excel estaban etiquetadas como "Provincia" col 3 de
-- DistribucionTerritorial.
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.municipio (
  codigo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  codigo_provincia VARCHAR(10) NOT NULL REFERENCES oficial.provincia(codigo)
);

CREATE INDEX idx_municipio_provincia ON oficial.municipio(codigo_provincia);

-- ──────────────────────────────────────────────────────────────────────
-- Recinto (FK ahora apunta a municipio real, no a la antigua "municipio"
-- que en realidad eran provincias)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.recinto (
  codigo_recinto BIGINT PRIMARY KEY,
  codigo_municipio VARCHAR(10) NOT NULL REFERENCES oficial.municipio(codigo),
  nombre VARCHAR(255) NOT NULL,
  direccion TEXT
);

CREATE INDEX idx_recinto_municipio ON oficial.recinto(codigo_municipio);

-- ──────────────────────────────────────────────────────────────────────
-- Mesa (sin cambios estructurales)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.mesa (
  codigo_mesa BIGINT PRIMARY KEY,
  codigo_recinto BIGINT NOT NULL REFERENCES oficial.recinto(codigo_recinto),
  nro_mesa INTEGER NOT NULL,
  votantes_habilitados INTEGER NOT NULL CHECK (votantes_habilitados >= 0)
);

CREATE INDEX idx_mesa_recinto ON oficial.mesa(codigo_recinto);

-- ──────────────────────────────────────────────────────────────────────
-- Partido (sin cambios; se carga vía INSERT en 04-carga-catalogos-v2.sql)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.partido (
  id_partido INTEGER PRIMARY KEY,
  sigla_candidato VARCHAR(10) NOT NULL UNIQUE,
  nombre_candidato VARCHAR(100) NOT NULL,
  sigla_partido VARCHAR(20) NOT NULL,
  color_hex VARCHAR(7) NOT NULL,
  orden_papeleta INTEGER NOT NULL UNIQUE
);

-- ──────────────────────────────────────────────────────────────────────
-- Acta oficial (AGREGAR 2 campos para observaciones formales)
-- observacion_formal: texto literal completo del docente.
-- tipo_observacion_formal: clasificación a una de las 9 categorías.
-- Ambos NULLABLE: la mayoría de actas no traen observación.
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.acta_oficial (
  id_acta BIGSERIAL PRIMARY KEY,
  codigo_acta BIGINT NOT NULL UNIQUE,
  codigo_mesa BIGINT NOT NULL REFERENCES oficial.mesa(codigo_mesa),
  votos_p1 INTEGER NOT NULL CHECK (votos_p1 >= 0),
  votos_p2 INTEGER NOT NULL CHECK (votos_p2 >= 0),
  votos_p3 INTEGER NOT NULL CHECK (votos_p3 >= 0),
  votos_p4 INTEGER NOT NULL CHECK (votos_p4 >= 0),
  blancos INTEGER NOT NULL CHECK (blancos >= 0),
  nulos INTEGER NOT NULL CHECK (nulos >= 0),
  habilitados INTEGER NOT NULL CHECK (habilitados >= 0),
  anfora INTEGER NOT NULL CHECK (anfora >= 0),
  no_usadas INTEGER NOT NULL CHECK (no_usadas >= 0),
  observacion_formal TEXT,
  tipo_observacion_formal oficial.tipo_observacion_formal,
  fecha_procesado TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acta_mesa ON oficial.acta_oficial(codigo_mesa);
CREATE INDEX idx_acta_tipo_obs ON oficial.acta_oficial(tipo_observacion_formal)
  WHERE tipo_observacion_formal IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- Log de inconsistencias (AGREGAR INCONSISTENCIA_NUMERICA)
-- Las 183 filas con votos negativos en Transcripciones se rechazan
-- pero se auditan acá en lugar de descartarse silenciosamente.
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.log_inconsistencias (
  id_log BIGSERIAL PRIMARY KEY,
  codigo_acta_intentado BIGINT NOT NULL,
  codigo_mesa_intentado BIGINT,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'ERROR1', 'ERROR2', 'ERROR3', 'ERROR4',
    'INCONSISTENCIA_NUMERICA'
  )),
  detalle TEXT NOT NULL,
  payload_json JSONB,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_tipo ON oficial.log_inconsistencias(tipo);
CREATE INDEX idx_log_fecha ON oficial.log_inconsistencias(fecha DESC);

-- ──────────────────────────────────────────────────────────────────────
-- Actas descartadas (sin cambios; cuarentena para filas estructuralmente
-- inválidas como las 45 con CodigoActa terminado en '0000000')
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE oficial.actas_descartadas (
  id BIGSERIAL PRIMARY KEY,
  codigo_acta BIGINT,
  codigo_mesa BIGINT,
  razon VARCHAR(100) NOT NULL,
  detalle TEXT,
  payload_json JSONB,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
