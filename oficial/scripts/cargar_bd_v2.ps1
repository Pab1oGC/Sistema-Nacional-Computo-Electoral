# cargar_bd_v2.ps1 — versión 2: fix de parse error y permission denied
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot/../..

Write-Host "[1/7] Verificando precondiciones..." -ForegroundColor Cyan
if (-not (Test-Path "oficial/datos_originales/csvs_v2/departamentos.csv")) {
    throw "ERROR: csvs_v2 no encontrado. Ejecutar primero extraer_catalogos_v2.py"
}
$containerRunning = docker ps --filter "name=oficial_master" --filter "status=running" -q
if (-not $containerRunning) {
    throw "ERROR: oficial_master no esta corriendo"
}

Write-Host "[2/7] Limpiando residuos previos en /tmp del container..." -ForegroundColor Cyan
# Usar --user root para borrar con permisos elevados
docker exec --user root oficial_master rm -rf /tmp/csvs_v2 /tmp/carga_catalogos.sql 2>$null
Write-Host "  Cleanup OK"

Write-Host "[3/7] Copiando CSVs al container..." -ForegroundColor Cyan
docker cp oficial/datos_originales/csvs_v2 oficial_master:/tmp/csvs_v2
$csvCount = (docker exec oficial_master ls /tmp/csvs_v2 | Measure-Object -Line).Lines
Write-Host "  CSVs copiados: $csvCount archivos"

Write-Host "[4/7] Detectando estado del schema..." -ForegroundColor Cyan
$schemaExists = docker exec oficial_master psql -U oficial_writer -d oficial -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'oficial'"
$tableCount = docker exec oficial_master psql -U oficial_writer -d oficial -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'oficial'"
$tableCount = $tableCount.Trim()

if ($schemaExists -and [int]$tableCount -ge 8) {
    Write-Host "  Schema v2 ya existe con $tableCount tablas. Skipping creacion."
} else {
    Write-Host "[4a/7] DROP schema viejo y crear v2..." -ForegroundColor Yellow
    docker exec oficial_master psql -U oficial_writer -d oficial -c "DROP SCHEMA IF EXISTS oficial CASCADE;"
    if ($LASTEXITCODE -ne 0) { throw "Fallo el DROP SCHEMA" }

    # Copiar schema SQL al container y ejecutarlo desde ahí
    docker cp oficial/sql/01-schema-v2.sql oficial_master:/tmp/01-schema-v2.sql
    docker exec oficial_master psql -U oficial_writer -d oficial -f /tmp/01-schema-v2.sql -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "Fallo la creacion del schema v2" }
}

Write-Host "[5/7] Verificando que las tablas estan vacias..." -ForegroundColor Cyan
$rowCount = docker exec oficial_master psql -U oficial_writer -d oficial -tAc "SELECT COUNT(*) FROM oficial.departamento"
if ([int]($rowCount.Trim()) -gt 0) {
    Write-Host "  WARNING: oficial.departamento ya tiene $rowCount filas. Truncando todo..." -ForegroundColor Yellow
    docker exec oficial_master psql -U oficial_writer -d oficial -c "TRUNCATE oficial.mesa, oficial.recinto, oficial.municipio, oficial.provincia, oficial.departamento, oficial.partido CASCADE;"
}

Write-Host "[6/7] Preparando SQL de carga (path /tmp/csvs_v2/)..." -ForegroundColor Cyan
# Leer SQL, reemplazar paths, escribir a archivo temp local, copiar al container
$sqlContent = Get-Content oficial/sql/04-carga-catalogos-v2.sql -Raw
$sqlModificado = $sqlContent -replace [regex]::Escape("/sql_data/csvs_v2/"), "/tmp/csvs_v2/"
$tempSql = New-TemporaryFile
$sqlModificado | Out-File -FilePath $tempSql.FullName -Encoding utf8 -NoNewline
docker cp $tempSql.FullName oficial_master:/tmp/carga_catalogos.sql
Remove-Item $tempSql.FullName

Write-Host "  Ejecutando carga..."
docker exec oficial_master psql -U oficial_writer -d oficial -f /tmp/carga_catalogos.sql -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw "Fallo la carga de catalogos" }

Write-Host ""
Write-Host "[7/7] Verificacion final..." -ForegroundColor Green
docker exec oficial_master psql -U oficial_writer -d oficial -c "
  SELECT 'departamento' AS tabla, COUNT(*) AS filas FROM oficial.departamento
  UNION ALL SELECT 'provincia', COUNT(*) FROM oficial.provincia
  UNION ALL SELECT 'municipio', COUNT(*) FROM oficial.municipio
  UNION ALL SELECT 'recinto', COUNT(*) FROM oficial.recinto
  UNION ALL SELECT 'mesa', COUNT(*) FROM oficial.mesa
  UNION ALL SELECT 'partido', COUNT(*) FROM oficial.partido
  ORDER BY tabla;
"

Write-Host ""
Write-Host "=== Test de drill-down geografico ===" -ForegroundColor Green
docker exec oficial_master psql -U oficial_writer -d oficial -c "
  SELECT
    m.codigo AS cod_muni, m.nombre AS municipio,
    p.codigo AS cod_prov, p.nombre AS provincia,
    d.codigo AS cod_dep, d.nombre AS departamento
  FROM oficial.municipio m
  JOIN oficial.provincia p ON m.codigo_provincia = p.codigo
  JOIN oficial.departamento d ON p.codigo_departamento = d.codigo
  WHERE m.nombre IN ('Bella Flor', 'Sucre', 'Yotala', 'La Paz', 'Cochabamba')
  ORDER BY d.codigo, p.codigo, m.codigo;
"

Write-Host ""
Write-Host "[OK] Carga completada." -ForegroundColor Green
