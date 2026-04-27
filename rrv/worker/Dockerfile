FROM python:3.12-slim

# Dependencias de sistema:
#  - poppler-utils → pdf2image (PDF a imagen)
#  - libgl1 + libglib2.0-0 → OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Directorio donde PaddleOCR descarga los modelos (persiste entre reinicios)
ENV PADDLEOCR_HOME=/app/.paddleocr

CMD ["python", "main.py"]
