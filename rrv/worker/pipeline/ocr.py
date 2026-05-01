import sys
import logging
import numpy as np
import pytesseract
from pytesseract import Output

logger = logging.getLogger(__name__)

# Ruta por defecto en Windows; en Linux/Docker el binario está en PATH
if sys.platform == "win32":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def run_ocr(img_array: np.ndarray) -> list[dict]:
    """
    Ejecuta Tesseract OCR sobre la imagen preprocesada y retorna bloques
    en el mismo formato que esperaba PaddleOCR:
    [{ text, confidence (0-1), bbox, y_center, x_center }]
    ordenados de arriba a abajo.
    """
    data = pytesseract.image_to_data(
        img_array,
        lang="spa",
        output_type=Output.DICT,
        config="--psm 6",   # bloque de texto uniforme (formulario)
    )

    blocks = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        conf = data["conf"][i]
        if not text or conf == -1:
            continue

        left = data["left"][i]
        top  = data["top"][i]
        w    = data["width"][i]
        h    = data["height"][i]

        blocks.append({
            "text":       text,
            "confidence": round(max(float(conf), 0) / 100.0, 3),
            "bbox":       [[left, top], [left + w, top], [left + w, top + h], [left, top + h]],
            "y_center":   top + h / 2,
            "x_center":   left + w / 2,
        })

    blocks.sort(key=lambda b: b["y_center"])
    return blocks
