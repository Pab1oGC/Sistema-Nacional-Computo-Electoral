@echo off
title Cluster RRV — MongoDB + Kafka + MinIO

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║    RRV — Levantando infraestructura completa            ║
echo  ║    MongoDB RS  +  Apache Kafka  +  MinIO                ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Docker no esta corriendo. Abre Docker Desktop.
    pause & exit /b 1
)
echo  [ok] Docker disponible

findstr /C:"mongo1" "C:\Windows\System32\drivers\etc\hosts" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ADVERTENCIA: Ejecuta agregar-hosts.bat como Administrador primero.
    echo.
    pause
)

echo.
echo  Deteniendo instancias previas...
docker compose down >nul 2>&1

echo  Iniciando servicios...
docker compose up -d

echo.
echo  ════════════════════════════════════════════════════════════
echo  Servicios levantados — URLs y conexiones:
echo.
echo  MongoDB Replica Set
echo    Primary   → localhost:27017
echo    Secondary → localhost:27018
echo    Secondary → localhost:27019
echo    ConnStr   → mongodb://mongo1:27017,mongo2:27017,mongo3:27017/rrv_db
echo                ?replicaSet=rrv-rs
echo.
echo  Apache Kafka
echo    Broker    → localhost:9094  (desde el host)
echo    Broker    → kafka:9092      (entre contenedores)
echo    Topics    → actas.recibidas / actas.ocr / actas.validadas
echo                actas.rechazadas / actas.dlq
echo.
echo  MinIO
echo    API S3    → http://localhost:9000
echo    Consola   → http://localhost:9001
echo    Usuario   → rrv_admin  /  rrv_minio_2025
echo    Buckets   → actas-rrv  /  actas-oficial
echo.
echo  Logs de inicializacion:
echo    docker logs rrv-mongo-setup
echo    docker logs rrv-kafka-init
echo    docker logs rrv-minio-init
echo.
echo  Estado del cluster:
echo    bash scripts/status.sh
echo  ════════════════════════════════════════════════════════════
echo.
pause
