#Requires -Version 5.1
# Levanta y configura toda la infraestructura RRV en Docker automaticamente.
# Idempotente: se puede ejecutar multiples veces sin efecto secundario.
# Hace: docker compose up + RS init + Schema + Seed + Kafka topics + MinIO buckets
$ErrorActionPreference = "Continue"

$SCRIPT_DIR   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$COMPOSE_FILE = "$SCRIPT_DIR\bdd\docker-compose.yml"
$INIT_DIR     = "$SCRIPT_DIR\bdd\init"

# ---- helpers ----------------------------------------------------------------
function Write-Header($msg) { Write-Host "" ; Write-Host "  $msg" -ForegroundColor Cyan }
function Write-OK($msg)     { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Skip($msg)   { Write-Host "  [SKIP] $msg" -ForegroundColor DarkGray }
function Write-Info($msg)   { Write-Host "         $msg" -ForegroundColor DarkGray }
function Write-Fail($msg)   { Write-Host "  [FAIL] $msg" -ForegroundColor Red ; exit 1 }

function Wait-Healthy([string]$name, [int]$maxSec = 120) {
    $t = 0
    $last = ""
    while ($true) {
        $s = (docker inspect --format "{{.State.Health.Status}}" $name 2>$null).Trim()
        if ($s -eq "healthy")   { return }
        if ($s -eq "unhealthy") { Write-Fail "$name esta unhealthy. Revisa: docker logs $name" }
        if ($s -ne $last)       { Write-Info "$name : $s ..." ; $last = $s }
        Start-Sleep -Seconds 3 ; $t += 3
        if ($t -ge $maxSec)     { Write-Fail "$name no llego a healthy en $maxSec seg" }
    }
}

function Mongo-Eval([string]$expr) {
    docker exec rrv-mongo1 mongosh --quiet --eval $expr 2>$null
}

# ============================================================================
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  RRV - Infraestructura Docker (setup automatico)   " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# ---- [0] Docker corriendo? --------------------------------------------------
Write-Header "[0/5] Verificando Docker"
$null = docker info 2>$null
if ($LASTEXITCODE -ne 0) { Write-Fail "Docker no esta corriendo. Inicia Docker Desktop." }
Write-OK "Docker Desktop activo"

# ============================================================================
# [1/5]  docker compose up
# ============================================================================
Write-Header "[1/5] Levantando contenedores"
docker compose -f $COMPOSE_FILE up -d
if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up fallo" }

Write-Info "Esperando MongoDB x3..."
Wait-Healthy "rrv-mongo1" 120
Wait-Healthy "rrv-mongo2" 120
Wait-Healthy "rrv-mongo3" 120
Write-OK "MongoDB x3 healthy"

# ============================================================================
# [2/5]  MongoDB Replica Set
# ============================================================================
Write-Header "[2/5] MongoDB Replica Set"

$initMount = $INIT_DIR.Replace('\', '/')

$rsOk = (Mongo-Eval "try{rs.status().ok}catch(e){0}").Trim()

if ($rsOk -match "^1") {
    Write-Skip "Replica Set rrv-rs ya estaba inicializado"
} else {
    Write-Info "Inicializando RS..."

    $out = (docker run --rm --network rrv-net -v "${initMount}:/scripts" mongo:7.0 mongosh --host mongo1 --quiet /scripts/00-rs-init.js 2>$null)
    Write-Info "rs.initiate() -> $out"

    Write-Info "Esperando Primary..."
    $elapsed = 0
    do {
        Start-Sleep -Seconds 3 ; $elapsed += 3
        $prim = (Mongo-Eval "rs.hello().isWritablePrimary").Trim()
        if ($elapsed -ge 90) { Write-Fail "Timeout esperando Primary (90 seg)" }
    } while ($prim -notmatch "true")
}


# ============================================================================
# [3/5]  Schema y Seed
# ============================================================================
Write-Header "[3/5] Schema y Seed"

Write-Info "Aplicando 02-schema.js ..."
docker run --rm `
    --network rrv-net `
    -v "${initMount}:/scripts" `
    mongo:7.0 `
    mongosh --host mongo1 --quiet /scripts/02-schema.js 2>$null | Out-Null
Write-OK "Schema aplicado"

# Seed solo si candidatos esta vacio
$seedCount = (Mongo-Eval "db.getSiblingDB('rrv_db').candidatos.countDocuments({})").Trim()
if ($seedCount -match "^[1-9]") {
    Write-Skip "Seed ya aplicado ($seedCount candidatos en BD)"
} else {
    Write-Info "Cargando 03-seed.js ..."
    docker run --rm `
        --network rrv-net `
        -v "${initMount}:/scripts" `
        mongo:7.0 `
        mongosh --host mongo1 --quiet /scripts/03-seed.js 2>$null | Out-Null
    Write-OK "Seed cargado"
}

# ============================================================================
# [4/5]  Kafka Topics
# ============================================================================
Write-Header "[4/5] Kafka topics"

Write-Info "Esperando Kafka healthy (puede tardar ~40 seg)..."
Wait-Healthy "rrv-kafka" 180
Write-OK "Kafka healthy"

$existing = (docker exec rrv-kafka kafka-topics.sh --list --bootstrap-server localhost:9094 2>$null)

$topics = @(
    @{ name="actas.recibidas";        parts=3 },
    @{ name="actas.ocr";              parts=3 },
    @{ name="actas.computables_rrv";  parts=3 },
    @{ name="actas.no_computables_rrv"; parts=3 },
    @{ name="actas.alertas_legales";  parts=1 },
    @{ name="actas.dlq";              parts=1 }
)

foreach ($t in $topics) {
    if ($existing -match [regex]::Escape($t.name)) {
        Write-Skip "$($t.name)"
    } else {
        docker exec rrv-kafka kafka-topics.sh `
            --create `
            --topic $t.name `
            --bootstrap-server localhost:9094 `
            --partitions $t.parts `
            --replication-factor 1 2>$null | Out-Null
        Write-OK "$($t.name)  ($($t.parts) particion/es)"
    }
}

# ============================================================================
# [5/5]  MinIO Buckets
# ============================================================================
Write-Header "[5/5] MinIO buckets"

Write-Info "Esperando MinIO healthy..."
Wait-Healthy "rrv-minio" 60
Write-OK "MinIO healthy"

$mcCmd = 'mc alias set rrv http://minio:9000 rrv_admin rrv_minio_2025 --quiet && mc mb --ignore-existing rrv/actas-rrv && mc mb --ignore-existing rrv/actas-oficial && mc anonymous set download rrv/actas-rrv && mc ls rrv'

docker run --rm `
    --network rrv-net `
    --entrypoint /bin/sh `
    minio/mc:latest `
    -c $mcCmd 2>$null | Where-Object { $_ -match "actas-" } | ForEach-Object { Write-OK $_.Trim() }

# ============================================================================
# Resumen
# ============================================================================
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Infraestructura RRV lista                         " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  MongoDB RS  ->  localhost:27017 / 27018 / 27019  " -ForegroundColor Green
Write-Host "               replicaSet=rrv-rs                   " -ForegroundColor Green
Write-Host "  Kafka       ->  localhost:9094                    " -ForegroundColor Green
Write-Host "  MinIO API   ->  http://localhost:9000             " -ForegroundColor Green
Write-Host "  MinIO Web   ->  http://localhost:9001             " -ForegroundColor Green
Write-Host "  MinIO creds ->  rrv_admin / rrv_minio_2025       " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para detener: .\infra_stop.ps1 (o STOP.bat)"
Write-Host ""
