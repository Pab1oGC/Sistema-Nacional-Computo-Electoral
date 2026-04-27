import numpy as np
import cv2
from pdf2image import convert_from_bytes


def preprocess(file_bytes: bytes, filename: str) -> np.ndarray:
    """Convierte el archivo (imagen o PDF) a un array numpy listo para OCR."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"

    if ext == "pdf":
        pages = convert_from_bytes(file_bytes, dpi=300, first_page=1, last_page=1)
        img = cv2.cvtColor(np.array(pages[0]), cv2.COLOR_RGB2BGR)
    else:
        arr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    # 1. Corrección de orientación gruesa (90° / 180°)
    img = _orient_landscape(img)

    # 2. Escalar si la imagen es muy pequeña (fotos de celular de baja res)
    img = _ensure_min_width(img, min_width=1200)

    # 3. Extraer tinta (azul y negra) sobre el fondo naranja del acta boliviana
    ink = _extract_ink(img)

    # 4. Corrección de inclinación fina (±30°)
    ink = _deskew(ink)

    # 5. Umbralización adaptativa — maneja iluminación desigual
    binary = cv2.adaptiveThreshold(
        ink, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 10,
    )

    # 6. Eliminar manchas pequeñas (ruido de punto) y rellenar huecos en letras
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN,  kernel, iterations=1)

    return cleaned


# ─── helpers ──────────────────────────────────────────────────────────────────

def _orient_landscape(img: np.ndarray) -> np.ndarray:
    """
    Las actas se fotografían a veces en vertical (portrait).
    Si la imagen es más alta que ancha, la rotamos 90° para quedar
    en horizontal (landscape), que es la orientación natural del formulario.
    """
    h, w = img.shape[:2]
    if h > w * 1.1:
        img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def _ensure_min_width(img: np.ndarray, min_width: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w < min_width:
        scale = min_width / w
        img = cv2.resize(img, (min_width, int(h * scale)), interpolation=cv2.INTER_CUBIC)
    return img


def _extract_ink(img_bgr: np.ndarray) -> np.ndarray:
    """
    Las actas bolivianas usan papel naranja/salmón con tinta azul (manual)
    y texto negro impreso. Para separar ambas tintas del fondo:

    - En el espacio BGR el naranja tiene R>>B, el azul tiene B>>R.
    - Calculamos R−B: positivo = fondo naranja, negativo = tinta azul.
    - Invertimos para que la tinta azul quede oscura (como texto).
    - Combinamos con la escala de grises (que captura bien la tinta negra)
      tomando el mínimo píxel (más oscuro = más tinta).
    """
    b_ch = img_bgr[:, :, 0].astype(np.int16)
    r_ch = img_bgr[:, :, 2].astype(np.int16)

    # R−B invertido: naranja→claro, azul→oscuro
    blue_extracted = np.clip(r_ch - b_ch + 128, 0, 255).astype(np.uint8)

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Mínimo: preserva tinta negra (gris oscuro) Y tinta azul (oscuro en blue_extracted)
    combined = np.minimum(gray, blue_extracted)

    # Normalizar contraste
    combined = cv2.normalize(combined, None, 0, 255, cv2.NORM_MINMAX)
    return combined


def _deskew(gray: np.ndarray) -> np.ndarray:
    """Corrige inclinación residual (hasta ±30°) usando la envolvente del texto."""
    try:
        # Binarizar brevemente para encontrar píxeles de texto
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(bw > 0))
        if len(coords) < 50:
            return gray

        angle = cv2.minAreaRect(coords)[-1]

        # minAreaRect devuelve −90…0; convertir a −45…45
        if angle < -45:
            angle = 90 + angle

        # No corregir si el ángulo es muy pequeño o demasiado grande
        # (>30° probablemente sea una foto en ángulo libre, no inclinación del doc)
        if abs(angle) < 0.5 or abs(angle) > 30:
            return gray

        h, w = gray.shape
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        return cv2.warpAffine(
            gray, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
    except Exception:
        return gray
