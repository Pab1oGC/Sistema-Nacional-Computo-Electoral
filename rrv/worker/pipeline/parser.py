import re
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# ─── Mapeo keyword → candidato_id ─────────────────────────────────────────────
# Debe coincidir con la colección `candidatos` en Mongo (ver 03-seed.js).
_CANDIDATOS_KW: dict[str, int] = {
    "TARGARYEN": 1, "DAENERYS": 1,
    "STARK":     2, "SANSA":   2,
    "BARATHEON": 3, "ROBERT":  3,
    "LANNISTER": 4, "TYRION":  4,
}

_NUM_RE  = re.compile(r"\d+")
_HORA_RE = re.compile(r"\b(\d{1,2})[:\s](\d{2})\b")


def _row_blocks(blocks: list[dict], ref: dict, max_dy: int = 35) -> list[dict]:
    """
    Devuelve todos los bloques en la misma fila que ref (|dy| <= max_dy),
    ordenados de izquierda a derecha.
    """
    return sorted(
        [b for b in blocks if abs(b["y_center"] - ref["y_center"]) <= max_dy],
        key=lambda b: b["x_center"],
    )


def _read_row_digits(
    blocks: list[dict],
    ref: dict,
    max_dy: int = 35,
    min_dx: int = 5,
) -> Optional[int]:
    """
    Las actas bolivianas escriben los votos en columnas de dígitos separados,
    p.ej. "2", "5", "7" en tres celdas distintas → 257.

    Recoge todos los tokens numéricos a la derecha de ref en la misma fila,
    los concatena en orden left→right y retorna el entero resultante.
    Si hay un salto de más de `col_gap` píxeles entre dígitos, asume que
    pertenecen a otro campo y se detiene.
    """
    row = _row_blocks(blocks, ref, max_dy)
    digits = ""
    last_x: Optional[float] = None
    col_gap = _estimate_col_gap(row)

    for b in row:
        dx = b["x_center"] - ref["x_center"]
        if dx < min_dx:
            continue  # ignorar bloques iguales o a la izquierda del label
        nums = _NUM_RE.findall(b["text"])
        if not nums:
            # Si encontramos texto no numérico después de ya haber recogido dígitos,
            # asumimos que salimos de la zona de votos de este candidato
            if digits:
                break
            continue
        if last_x is not None and (b["x_center"] - last_x) > col_gap:
            # Salto grande: pertenece a otra columna/campo
            break
        digits += "".join(nums)
        last_x = b["x_center"]

    return int(digits) if digits else None


def _estimate_col_gap(row: list[dict]) -> float:
    """
    Estima el espaciado entre columnas de dígitos.
    Si hay pocos bloques, usa un valor conservador.
    """
    if len(row) < 2:
        return 120.0
    gaps = [
        row[i + 1]["x_center"] - row[i]["x_center"]
        for i in range(len(row) - 1)
    ]
    median = sorted(gaps)[len(gaps) // 2]
    # Permitir hasta el doble del gap típico antes de cortar
    return max(median * 2.0, 80.0)


def _nearest_number(
    blocks: list[dict],
    ref: dict,
    direction: str = "right",
    max_dy: int = 40,
) -> Optional[int]:
    """Busca el número más cercano al bloque ref en la dirección indicada (fallback)."""
    best_val, best_dist = None, float("inf")
    for b in blocks:
        if not _NUM_RE.search(b["text"]):
            continue
        dy = abs(b["y_center"] - ref["y_center"])
        if dy > max_dy:
            continue
        dx = b["x_center"] - ref["x_center"]
        if direction == "right" and dx <= 0:
            continue
        if direction == "left" and dx >= 0:
            continue
        dist = abs(dx) + dy * 2
        if dist < best_dist:
            nums = _NUM_RE.findall(b["text"])
            if nums:
                best_dist = dist
                best_val = int(nums[-1])
    return best_val


def parse_acta(blocks: list[dict], id_acta: str, codigo_mesa: int) -> dict:
    """
    Convierte los bloques OCR en un dict estructurado.
    Campos no encontrados quedan en None — el Validador los marcará.
    """
    votos_candidatos: list[dict] = []
    votos_validos: Optional[int] = None
    votos_blancos: Optional[int] = None
    votos_nulos:   Optional[int] = None
    ciudadanos_habilitados: Optional[int] = None
    papeletas_anfora: Optional[int] = None
    hora_apertura: Optional[str] = None
    hora_cierre:   Optional[str] = None
    confianzas:    list[float]   = []

    upper_blocks = [(b, b["text"].upper()) for b in blocks]

    # ── Votos por candidato ────────────────────────────────────────────────
    for block, upper in upper_blocks:
        for kw, cid in _CANDIDATOS_KW.items():
            if kw not in upper:
                continue
            if any(v["candidato_id"] == cid for v in votos_candidatos):
                break  # ya registrado

            # Intentar lectura con merge de dígitos en columna
            num = _read_row_digits(blocks, block)
            # Fallback al método simple si no se encontró nada
            if num is None:
                num = _nearest_number(blocks, block, direction="right")
            if num is not None:
                votos_candidatos.append({"candidato_id": cid, "votos": num})
                confianzas.append(block["confidence"])
            break

    # ── Totales ───────────────────────────────────────────────────────────
    for block, upper in upper_blocks:
        # Intentar con merge de dígitos primero; fallback a nearest
        num = _read_row_digits(blocks, block) or _nearest_number(blocks, block, direction="right")
        if num is None:
            continue
        if "VALID" in upper and votos_validos is None:
            votos_validos = num
        elif ("BLANC" in upper or "BLANK" in upper) and votos_blancos is None:
            votos_blancos = num
        elif "NUL" in upper and votos_nulos is None:
            votos_nulos = num
        elif ("HABILIT" in upper or "HABILI" in upper) and ciudadanos_habilitados is None:
            ciudadanos_habilitados = num
        elif "ANFORA" in upper and papeletas_anfora is None:
            papeletas_anfora = num

    # ── Horas (formato "HH:MM" o dígitos separados) ───────────────────────
    hora_candidates: list[str] = []
    for b, _ in upper_blocks:
        m = _HORA_RE.search(b["text"])
        if m:
            hora_candidates.append(f"{m.group(1)}:{m.group(2)}")
    # Si no hay ":" pero hay bloques con "APERTURA" / "CIERRE", intentar nearest
    if not hora_candidates:
        for block, upper in upper_blocks:
            if "APERTURA" in upper and hora_apertura is None:
                num = _read_row_digits(blocks, block)
                if num:
                    hora_apertura = str(num)
            elif "CIERRE" in upper and hora_cierre is None:
                num = _read_row_digits(blocks, block)
                if num:
                    hora_cierre = str(num)
    else:
        hora_apertura = hora_candidates[0]
        if len(hora_candidates) >= 2:
            hora_cierre = hora_candidates[-1]

    # ── Confianza y flags ─────────────────────────────────────────────────
    confianza_prom = round(sum(confianzas) / len(confianzas), 3) if confianzas else 0.0
    requiere_revision = (
        confianza_prom < settings.ocr_min_confidence
        or not votos_candidatos
        or votos_validos is None
    )

    logger.info(
        "Parser mesa=%s candidatos=%d válidos=%s blancos=%s nulos=%s "
        "confianza=%.2f revision=%s",
        codigo_mesa, len(votos_candidatos), votos_validos,
        votos_blancos, votos_nulos, confianza_prom, requiere_revision,
    )

    return {
        "id_acta":                id_acta,
        "codigo_mesa":            codigo_mesa,
        "tipo_entrada":           "FOTO",
        "votos_extraidos":        votos_candidatos,
        "validos":                votos_validos,
        "blancos":                votos_blancos,
        "nulos":                  votos_nulos,
        "ciudadanos_habilitados": ciudadanos_habilitados,
        "papeletas_anfora":       papeletas_anfora,
        "hora_apertura":          hora_apertura,
        "hora_cierre":            hora_cierre,
        "confianza_ocr":          confianza_prom,
        "requiere_revision":      requiere_revision,
        "total_bloques_ocr":      len(blocks),
    }
