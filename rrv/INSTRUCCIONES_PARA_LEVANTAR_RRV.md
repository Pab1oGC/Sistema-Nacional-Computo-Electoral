# Instrucciones para probar RRV en otra computadora

Este documento asume que se ejecutaran los servicios Python desde Windows/host y la infraestructura desde Docker.

## 1. Requisitos

- Docker Desktop instalado y corriendo.
- Python 3.12 instalado.
- Git instalado.
- Tesseract OCR instalado en Windows.

Ruta esperada de Tesseract:

```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

## 2. Clonar el repositorio

```powershell
git clone <URL_DEL_REPO>
cd Sistema-Nacional-Computo-Electoral
```

## 3. Levantar infraestructura

Desde la raiz del proyecto:

```powershell
.\infra_start.ps1
```

Ese script levanta y prepara:

- MongoDB replica set.
- Kafka.
- MinIO.
- Schema y seed inicial de MongoDB.
- Topics Kafka.
- Buckets MinIO.

## 4. Crear archivos `.env`

Desde la raiz del proyecto:

```powershell
copy rrv\api\.env.example rrv\api\.env
copy rrv\worker\.env.example rrv\worker\.env
copy rrv\validator\.env.example rrv\validator\.env
```

Los `.env` no deben subirse a GitHub. Solo se suben los `.env.example`.

## 5. Crear entorno Python e instalar dependencias

API:

```powershell
cd rrv\api
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Worker:

```powershell
cd ..\worker
..\api\venv\Scripts\pip.exe install -r requirements.txt
```

Validator:

```powershell
cd ..\validator
..\api\venv\Scripts\pip.exe install -r requirements.txt
```

## 6. Ejecutar servicios

Abrir tres terminales.

Terminal 1, API:

```powershell
cd rrv\api
.\venv\Scripts\python.exe -m uvicorn main:app --reload
```

Terminal 2, worker OCR:

```powershell
cd rrv\worker
..\api\venv\Scripts\python.exe main.py
```

Terminal 3, validator:

```powershell
cd rrv\validator
..\api\venv\Scripts\python.exe main.py
```

## 7. Verificar estado

Abrir:

```text
http://127.0.0.1:8000/health
```

Respuesta esperada:

```json
{"status":"ok","mongo":"ok","kafka":"ok"}
```

Dashboard simple:

```text
http://127.0.0.1:8000/dashboard
```

## 8. Cargar actas de prueba

Con API, worker y validator corriendo:

```powershell
cd rrv
api\venv\Scripts\python.exe bulk_upload.py --api http://127.0.0.1:8000 --dir actas
```

## 9. Ver logs y auditoria

Inconsistencias:

```powershell
docker exec rrv-mongo2 mongosh rrv_db --quiet --eval "db.logs_inconsistencias.find().sort({ts:-1}).limit(10).pretty()"
```

Eventos:

```powershell
docker exec rrv-mongo2 mongosh rrv_db --quiet --eval "db.eventos.find().sort({timestamp:-1}).limit(10).pretty()"
```

## 10. Detener infraestructura

Desde la raiz del proyecto:

```powershell
.\infra_stop.ps1
```

Para borrar todos los datos locales de Docker:

```powershell
.\infra_stop.ps1 -Purge
```

Usar `-Purge` solo si se quiere reiniciar desde cero.
