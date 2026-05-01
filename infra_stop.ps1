#Requires -Version 5.1
# Para los contenedores Docker de la infraestructura RRV.
# Los datos se conservan en los volumenes Docker.
# Para borrar todo usar: .\infra_stop.ps1 -Purge
param([switch]$Purge)

$COMPOSE_FILE = "$PSScriptRoot\bdd\docker-compose.yml"

Write-Host ""
if ($Purge) {
    Write-Host "=================================================" -ForegroundColor Red
    Write-Host "  RRV - Deteniendo y BORRANDO todos los datos   " -ForegroundColor Red
    Write-Host "=================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Esto borrara todos los datos de MongoDB, Kafka y MinIO." -ForegroundColor Yellow
    $confirm = Read-Host "  Confirmas? (s/N)"
    if ($confirm -notmatch "^[sS]$") { Write-Host "  Cancelado."; exit 0 }
    docker compose -f $COMPOSE_FILE down -v
} else {
    Write-Host "=================================================" -ForegroundColor Yellow
    Write-Host "  RRV - Deteniendo infraestructura              " -ForegroundColor Yellow
    Write-Host "=================================================" -ForegroundColor Yellow
    Write-Host ""
    docker compose -f $COMPOSE_FILE down
}

Write-Host ""
Write-Host "  Contenedores detenidos." -ForegroundColor White
if ($Purge) {
    Write-Host "  Todos los datos fueron borrados." -ForegroundColor DarkGray
    Write-Host "  El proximo START.bat inicializara desde cero." -ForegroundColor DarkGray
} else {
    Write-Host "  Datos conservados en volumenes Docker." -ForegroundColor DarkGray
    Write-Host "  Para levantar de nuevo: START.bat" -ForegroundColor DarkGray
}
Write-Host ""
