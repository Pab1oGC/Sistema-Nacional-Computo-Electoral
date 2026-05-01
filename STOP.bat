@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra_stop.ps1"
echo.
pause
