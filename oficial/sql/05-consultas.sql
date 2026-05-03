-- ============================================================
-- 05-consultas.sql
-- Banco de las 20 consultas obligatorias del enunciado del docente.
--
-- Cada consulta:
--   - Numerada y comentada con el KPI que responde.
--   - Usa solo datos del módulo Oficial. Las consultas que comparan
--     TREP vs Oficial (e.g. consulta 7, 8) traen solo la parte
--     Oficial; el merge se hace en el dashboard.
--
-- Para correrlas:
--   docker exec -i oficial_master psql -U postgres -d oficial < sql/05-consultas.sql
--
-- O una por una con el slash command /consultas.
-- ============================================================

-- ============================================================
-- Consulta 1: Cantidad de mesas por recinto y departamento
-- KPI: distribución del despliegue territorial.
-- ============================================================
SELECT
    d.nombre              AS departamento,
    r.codigo_recinto,
    r.nombre              AS recinto,
    COUNT(m.codigo_mesa)  AS cantidad_mesas
FROM oficial.departamento d
JOIN oficial.municipio  mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto    r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa       m  ON m.codigo_recinto       = r.codigo_recinto
GROUP BY d.nombre, r.codigo_recinto, r.nombre
ORDER BY d.nombre, r.codigo_recinto;

-- ============================================================
-- Consulta 2: Registro de votos (papeletas en ánfora) por municipio
-- KPI: volumen de votación a nivel municipal.
-- ============================================================
SELECT
    mu.codigo            AS codigo_municipio,
    mu.nombre            AS municipio,
    SUM(a.anfora)        AS papeletas_anfora
FROM oficial.municipio mu
JOIN oficial.recinto      r ON r.codigo_municipio = mu.codigo
JOIN oficial.mesa         m ON m.codigo_recinto   = r.codigo_recinto
JOIN oficial.acta_oficial a ON a.codigo_mesa      = m.codigo_mesa
GROUP BY mu.codigo, mu.nombre
ORDER BY papeletas_anfora DESC;

-- ============================================================
-- Consulta 3: Cantidad de votos por departamento
-- KPI: total contado por departamento (válidos + blancos + nulos).
-- ============================================================
SELECT
    d.nombre                                                      AS departamento,
    SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4)        AS votos_partidos,
    SUM(a.blancos)                                                AS blancos,
    SUM(a.nulos)                                                  AS nulos,
    SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4
        + a.blancos + a.nulos)                                    AS total
FROM oficial.departamento d
JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
GROUP BY d.nombre
ORDER BY total DESC;

-- ============================================================
-- Consulta 4: Top 5 recintos con más votos para cada partido
-- KPI: bastiones territoriales por candidato.
-- ============================================================
WITH votos_recinto AS (
    SELECT
        r.codigo_recinto,
        r.nombre AS recinto,
        SUM(a.votos_p1) AS p1,
        SUM(a.votos_p2) AS p2,
        SUM(a.votos_p3) AS p3,
        SUM(a.votos_p4) AS p4
    FROM oficial.recinto      r
    JOIN oficial.mesa         m ON m.codigo_recinto = r.codigo_recinto
    JOIN oficial.acta_oficial a ON a.codigo_mesa    = m.codigo_mesa
    GROUP BY r.codigo_recinto, r.nombre
),
unpivoted AS (
    SELECT codigo_recinto, recinto, 1 AS partido_id, p1 AS votos FROM votos_recinto
    UNION ALL SELECT codigo_recinto, recinto, 2, p2 FROM votos_recinto
    UNION ALL SELECT codigo_recinto, recinto, 3, p3 FROM votos_recinto
    UNION ALL SELECT codigo_recinto, recinto, 4, p4 FROM votos_recinto
),
ranked AS (
    SELECT
        u.codigo_recinto,
        u.recinto,
        p.sigla_candidato,
        p.nombre_candidato,
        u.votos,
        ROW_NUMBER() OVER (PARTITION BY u.partido_id ORDER BY u.votos DESC) AS rk
    FROM unpivoted u
    JOIN oficial.partido p ON p.id_partido = u.partido_id
)
SELECT codigo_recinto, recinto, sigla_candidato, nombre_candidato, votos
FROM ranked
WHERE rk <= 5
ORDER BY sigla_candidato, votos DESC;

-- ============================================================
-- Consulta 5: Votos nulos por departamento y % sobre válidos
-- KPI: calidad del voto. Nulos altos → educación electoral baja
-- o disputa política.
-- ============================================================
SELECT
    d.nombre AS departamento,
    SUM(a.nulos) AS votos_nulos,
    SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4) AS votos_validos,
    ROUND(
        SUM(a.nulos)::NUMERIC * 100
        / NULLIF(SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4), 0),
        2
    ) AS pct_nulos_sobre_validos
FROM oficial.departamento d
JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
GROUP BY d.nombre
ORDER BY pct_nulos_sobre_validos DESC NULLS LAST;

-- ============================================================
-- Consulta 6: Listado de actas anuladas
-- En el módulo Oficial: actas que tienen al menos una entrada en
-- log_inconsistencias con tipo ERROR1 o ERROR2 (validación falló).
-- KPI: trazabilidad de actas rechazadas para audit legal.
-- ============================================================
SELECT DISTINCT
    li.codigo_acta,
    li.codigo_mesa,
    li.tipo,
    li.mensaje,
    li.timestamp
FROM oficial.log_inconsistencias li
WHERE li.tipo IN ('ERROR1', 'ERROR2')
ORDER BY li.timestamp DESC;

-- ============================================================
-- Consulta 7: Cantidad de votos totales del Oficial
-- KPI: total agregado para comparar con TREP en el dashboard.
-- En mi consulta solo agrego los míos; el dashboard hace el merge.
-- ============================================================
SELECT
    SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4) AS votos_validos,
    SUM(a.blancos)                                          AS votos_blancos,
    SUM(a.nulos)                                            AS votos_nulos,
    SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4
        + a.blancos + a.nulos)                              AS total_votos
FROM oficial.acta_oficial a;

-- ============================================================
-- Consulta 8: Total de votos por candidato
-- KPI: standings nacionales. El comparativo TREP vs Oficial lo
-- hace el dashboard consumiendo /api/v1/oficial/resultados y el
-- equivalente del RRV.
-- ============================================================
WITH totales AS (
    SELECT
        SUM(votos_p1) AS p1,
        SUM(votos_p2) AS p2,
        SUM(votos_p3) AS p3,
        SUM(votos_p4) AS p4
    FROM oficial.acta_oficial
)
SELECT
    p.id_partido,
    p.sigla_candidato,
    p.nombre_candidato,
    p.sigla_partido,
    p.color_hex,
    p.orden_papeleta,
    COALESCE(
        CASE p.id_partido
            WHEN 1 THEN t.p1
            WHEN 2 THEN t.p2
            WHEN 3 THEN t.p3
            WHEN 4 THEN t.p4
        END,
        0
    ) AS votos_total
FROM oficial.partido p
CROSS JOIN totales t
ORDER BY p.orden_papeleta;

-- ============================================================
-- Consulta 9: Votos nulos, blancos y por candidato, total por departamento
-- KPI: matriz completa territorio × tipo de voto.
-- ============================================================
SELECT
    d.codigo                AS codigo_departamento,
    d.nombre                AS departamento,
    SUM(a.votos_p1)         AS p1,
    SUM(a.votos_p2)         AS p2,
    SUM(a.votos_p3)         AS p3,
    SUM(a.votos_p4)         AS p4,
    SUM(a.blancos)          AS blancos,
    SUM(a.nulos)            AS nulos,
    SUM(a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4
        + a.blancos + a.nulos) AS total
FROM oficial.departamento d
JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
GROUP BY d.codigo, d.nombre
ORDER BY d.codigo;

-- ============================================================
-- Consulta 10: Centros (recintos) activos y cantidad de actas enviadas
-- KPI: cobertura del cómputo. Recintos sin actas son red flag.
-- ============================================================
SELECT
    r.codigo_recinto,
    r.nombre        AS recinto,
    mu.nombre       AS municipio,
    d.nombre        AS departamento,
    COUNT(a.id_acta) AS actas_enviadas
FROM oficial.recinto      r
JOIN oficial.municipio    mu ON mu.codigo            = r.codigo_municipio
JOIN oficial.departamento d  ON d.codigo             = mu.codigo_departamento
LEFT JOIN oficial.mesa         m ON m.codigo_recinto = r.codigo_recinto
LEFT JOIN oficial.acta_oficial a ON a.codigo_mesa    = m.codigo_mesa
GROUP BY r.codigo_recinto, r.nombre, mu.nombre, d.nombre
HAVING COUNT(a.id_acta) > 0
ORDER BY actas_enviadas DESC;

-- ============================================================
-- Consulta 11: Mesas con > 20% de abstención
-- Abstención = no_usadas / habilitados.
-- KPI: focos de baja participación.
-- ============================================================
SELECT
    a.codigo_mesa,
    a.codigo_acta,
    a.habilitados,
    a.no_usadas,
    ROUND(a.no_usadas::NUMERIC * 100 / NULLIF(a.habilitados, 0), 2) AS pct_abstencion
FROM oficial.acta_oficial a
WHERE a.no_usadas::NUMERIC / NULLIF(a.habilitados, 0) > 0.20
ORDER BY pct_abstencion DESC;

-- ============================================================
-- Consulta 12: Actas Oficial recibidas en el centro de cómputo, por hora
-- Basado en fecha_creacion (timestamp de recepción en el API).
-- KPI: throughput del cómputo a lo largo del día.
-- ============================================================
SELECT
    DATE_TRUNC('hour', a.fecha_creacion) AS hora_recepcion,
    COUNT(*)                              AS actas_recibidas
FROM oficial.acta_oficial a
GROUP BY DATE_TRUNC('hour', a.fecha_creacion)
ORDER BY hora_recepcion;

-- ============================================================
-- Consulta 13: % de actas con inconsistencias por departamento
-- KPI: calidad de transcripción por jurisdicción.
-- ============================================================
WITH actas_por_depto AS (
    SELECT
        d.codigo                AS codigo_departamento,
        d.nombre                AS departamento,
        COUNT(DISTINCT a.id_acta) AS total_actas
    FROM oficial.departamento d
    JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
    JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
    JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
    JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
    GROUP BY d.codigo, d.nombre
),
inconsistentes_por_depto AS (
    SELECT
        d.codigo                          AS codigo_departamento,
        COUNT(DISTINCT li.codigo_acta)    AS actas_inconsistentes
    FROM oficial.departamento d
    JOIN oficial.municipio       mu ON mu.codigo_departamento = d.codigo
    JOIN oficial.recinto         r  ON r.codigo_municipio     = mu.codigo
    JOIN oficial.mesa            m  ON m.codigo_recinto       = r.codigo_recinto
    JOIN oficial.log_inconsistencias li ON li.codigo_mesa     = m.codigo_mesa
    WHERE li.tipo IN ('ERROR1', 'ERROR2')
    GROUP BY d.codigo
)
SELECT
    a.codigo_departamento,
    a.departamento,
    a.total_actas,
    COALESCE(i.actas_inconsistentes, 0) AS actas_inconsistentes,
    ROUND(
        COALESCE(i.actas_inconsistentes, 0)::NUMERIC * 100
        / NULLIF(a.total_actas, 0),
        2
    ) AS pct_inconsistencia
FROM actas_por_depto a
LEFT JOIN inconsistentes_por_depto i
    ON i.codigo_departamento = a.codigo_departamento
ORDER BY pct_inconsistencia DESC NULLS LAST;

-- ============================================================
-- Consulta 14: Tiempo entre primera y última acta de cada departamento
-- Basado en fecha_creacion. KPI: velocidad de transcripción
-- regional / cuello de botella territorial.
-- ============================================================
SELECT
    d.codigo                                AS codigo_departamento,
    d.nombre                                AS departamento,
    MIN(a.fecha_creacion)                   AS primera_acta,
    MAX(a.fecha_creacion)                   AS ultima_acta,
    MAX(a.fecha_creacion) - MIN(a.fecha_creacion) AS span,
    ROUND(
        EXTRACT(EPOCH FROM (MAX(a.fecha_creacion) - MIN(a.fecha_creacion)))::NUMERIC / 60,
        2
    ) AS span_minutos
FROM oficial.departamento d
JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
GROUP BY d.codigo, d.nombre
ORDER BY span_minutos DESC;

-- ============================================================
-- Consulta 15: % de confiabilidad del Oficial
-- (actas sin inconsistencias) / total
-- KPI: indicador agregado de calidad del cómputo.
-- ============================================================
WITH stats AS (
    SELECT
        (SELECT COUNT(*) FROM oficial.acta_oficial) AS total_actas,
        (SELECT COUNT(DISTINCT codigo_acta)
           FROM oficial.log_inconsistencias
          WHERE tipo IN ('ERROR1', 'ERROR2')) AS actas_con_problema
)
SELECT
    total_actas,
    actas_con_problema,
    total_actas - actas_con_problema AS actas_confiables,
    ROUND(
        (total_actas - actas_con_problema)::NUMERIC * 100
        / NULLIF(total_actas, 0),
        2
    ) AS pct_confiabilidad
FROM stats;

-- ============================================================
-- Consulta 16: % de participación ciudadana por departamento
-- Participación = anfora / habilitados.
-- KPI: indicador democrático fundamental.
-- ============================================================
SELECT
    d.codigo,
    d.nombre               AS departamento,
    SUM(a.habilitados)     AS total_habilitados,
    SUM(a.anfora)          AS total_anfora,
    ROUND(
        SUM(a.anfora)::NUMERIC * 100 / NULLIF(SUM(a.habilitados), 0),
        2
    ) AS pct_participacion
FROM oficial.departamento d
JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
GROUP BY d.codigo, d.nombre
ORDER BY pct_participacion DESC;

-- ============================================================
-- Consulta 17: Actas con inconsistencias entre lo recibido y lo esperado
-- En el módulo Oficial: las que tienen log_inconsistencias asociadas,
-- con sus valores recibidos (JSONB).
-- KPI: vista detallada para audit y corrección.
-- ============================================================
SELECT
    li.codigo_acta,
    li.codigo_mesa,
    li.tipo,
    li.mensaje,
    li.valores_recibidos,
    li.timestamp,
    li.resuelto
FROM oficial.log_inconsistencias li
ORDER BY li.timestamp DESC;

-- ============================================================
-- Consulta 18: NO APLICA al módulo Oficial.
-- Esta consulta es del enunciado para PDFs/MB del RRV (procesa
-- imágenes y PDFs). El Cómputo Oficial trabaja sobre transcripciones
-- CSV; no maneja archivos binarios. Responsabilidad del team lider.
-- ============================================================
SELECT 'NO_APLICA' AS resultado,
       'Consulta 18 corresponde al RRV (procesamiento de PDFs/imágenes)' AS motivo;

-- ============================================================
-- Consulta 19: Resultados por departamento, municipio o provincia
-- (parametrizado).
-- En SQL puro: versión "por departamento" como ejemplo. La versión
-- parametrizada (filtros por nivel territorial) se hace desde el use
-- case `ConsultarResultadosUseCase` en application/.
-- KPI: drill-down territorial de los resultados.
-- ============================================================
SELECT
    d.codigo,
    d.nombre AS departamento,
    p.sigla_candidato,
    p.nombre_candidato,
    p.sigla_partido,
    p.color_hex,
    SUM(
        CASE p.id_partido
            WHEN 1 THEN a.votos_p1
            WHEN 2 THEN a.votos_p2
            WHEN 3 THEN a.votos_p3
            WHEN 4 THEN a.votos_p4
        END
    ) AS votos
FROM oficial.departamento d
JOIN oficial.municipio    mu ON mu.codigo_departamento = d.codigo
JOIN oficial.recinto      r  ON r.codigo_municipio     = mu.codigo
JOIN oficial.mesa         m  ON m.codigo_recinto       = r.codigo_recinto
JOIN oficial.acta_oficial a  ON a.codigo_mesa          = m.codigo_mesa
CROSS JOIN oficial.partido p
GROUP BY d.codigo, d.nombre, p.sigla_candidato, p.nombre_candidato,
         p.sigla_partido, p.color_hex, p.orden_papeleta
ORDER BY d.codigo, p.orden_papeleta;

-- ============================================================
-- Consulta 20: Error más común detectado
-- KPI: tipo de inconsistencia más frecuente. Sirve para priorizar
-- mejoras en el proceso de transcripción.
-- ============================================================
SELECT
    tipo,
    COUNT(*) AS total
FROM oficial.log_inconsistencias
GROUP BY tipo
ORDER BY total DESC
LIMIT 1;
