-- =====================================================================
-- 04-carga-catalogos-v2.sql — Carga de catálogos para el schema v2
-- =====================================================================
-- Pre-requisitos:
--   1. 01-schema-v2.sql ejecutado (tablas y enum creados, vacías).
--   2. CSVs generados con scripts/extraer_catalogos_v2.py en
--      oficial/datos_originales/csvs_v2/.
--
-- Las rutas son relativas a la ejecución dentro del container postgres.
-- En FASE 2 se montará el directorio csvs_v2/ como volumen en /sql_data/.
-- =====================================================================

-- Nota: usamos COPY (SQL server-side) y NO \copy (meta-comando psql).
-- \copy no admite saltos de línea; COPY sí. Los CSV están en el filesystem
-- del server (vía docker cp en la fase de carga).
COPY oficial.departamento(codigo, nombre)
  FROM '/sql_data/csvs_v2/departamentos.csv'
  WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

COPY oficial.provincia(codigo, nombre, codigo_departamento)
  FROM '/sql_data/csvs_v2/provincias.csv'
  WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

COPY oficial.municipio(codigo, nombre, codigo_provincia)
  FROM '/sql_data/csvs_v2/municipios.csv'
  WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

COPY oficial.recinto(codigo_recinto, codigo_municipio, nombre, direccion)
  FROM '/sql_data/csvs_v2/recintos.csv'
  WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

COPY oficial.mesa(codigo_mesa, codigo_recinto, nro_mesa, votantes_habilitados)
  FROM '/sql_data/csvs_v2/mesas.csv'
  WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

INSERT INTO oficial.partido (id_partido, sigla_candidato, nombre_candidato,
                              sigla_partido, color_hex, orden_papeleta) VALUES
(1, 'P1', 'Daenerys Targaryen', 'MAS-ISP', '#003087', 1),
(2, 'P2', 'Sansa Stark', 'CC', '#E63946', 2),
(3, 'P3', 'Robert Baratheon', 'Creemos', '#F4A261', 3),
(4, 'P4', 'Tyrion Lannister', 'APB', '#2A9D8F', 4);

-- Verificación de conteos. Esperado: 9 / 112 / 340 / 537 / 5357 / 4
SELECT 'departamento' AS tabla, COUNT(*) AS filas FROM oficial.departamento
UNION ALL SELECT 'provincia', COUNT(*) FROM oficial.provincia
UNION ALL SELECT 'municipio', COUNT(*) FROM oficial.municipio
UNION ALL SELECT 'recinto', COUNT(*) FROM oficial.recinto
UNION ALL SELECT 'mesa', COUNT(*) FROM oficial.mesa
UNION ALL SELECT 'partido', COUNT(*) FROM oficial.partido;
