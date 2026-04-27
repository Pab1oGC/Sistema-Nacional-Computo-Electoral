@echo off
REM ─────────────────────────────────────────────────────────────────────────
REM  agregar-hosts.bat — Añade mongo1/mongo2/mongo3 al archivo hosts
REM  EJECUTAR COMO ADMINISTRADOR (clic derecho → "Ejecutar como administrador")
REM
REM  Esto es necesario para que la app del host pueda resolver los nombres
REM  de los nodos del Replica Set (que viven dentro de Docker).
REM ─────────────────────────────────────────────────────────────────────────
title Configurar Hosts — RRV

echo.
echo  Configurando archivo hosts para el cluster MongoDB...
echo.

REM Verificar privilegios de administrador
net session >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Este script requiere privilegios de Administrador.
    echo  Haz clic derecho en el archivo y selecciona "Ejecutar como administrador".
    echo.
    pause
    exit /b 1
)
echo  [ok] Ejecutando como Administrador

set HOSTS=C:\Windows\System32\drivers\etc\hosts
set ENTRADA=127.0.0.1 mongo1 mongo2 mongo3

findstr /C:"mongo1" "%HOSTS%" >nul 2>&1
if not errorlevel 1 (
    echo  [info] Las entradas ya existen en el archivo hosts.
    echo.
    goto FIN
)

echo.>> "%HOSTS%"
echo # MongoDB Replica Set RRV (generado por agregar-hosts.bat)>> "%HOSTS%"
echo %ENTRADA%>> "%HOSTS%"

echo  [ok] Entradas añadidas:
echo       127.0.0.1  mongo1  mongo2  mongo3
echo.
echo  Verifica con: ping mongo1

:FIN
echo.
echo  Ahora puedes ejecutar levantar.bat
echo.
pause
