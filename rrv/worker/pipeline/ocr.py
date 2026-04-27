import logging
import numpy as np
from paddleocr import PaddleOCR

logger = logging.getLogger(__name__)

_ocr: PaddleOCR | None = None


def _get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        logger.info("Cargando modelo PaddleOCR (primera carga, descarga ~100MB)...")
        _ocr = PaddleOCR(
            use_angle_cls=True,
            lang="es",
            use_gpu=False,
            show_log=False,
        )
        logger.info("Modelo PaddleOCR listo")
    return _ocr


def run_ocr(img_array: np.ndarray) -> list[dict]:
    """
    Ejecuta PaddleOCR sobre la imagen y retorna los bloques detectados
    ordenados de arriba a abajo (orden de lectura).
    """
    results = _get_ocr().ocr(img_array, cls=True)

    blocks = []
    if not results or not results[0]:
        return blocks

    for line in results[0]:
        bbox, (text, conf) = line
        y_center = (bbox[0][1] + bbox[2][1]) / 2
        x_center = (bbox[0][0] + bbox[2][0]) / 2
        blocks.append({
            "text": text.strip(),
            "confidence": round(float(conf), 3),
            "bbox": bbox,
            "y_center": y_center,
            "x_center": x_center,
        })

    blocks.sort(key=lambda b: b["y_center"])
    return blocks
