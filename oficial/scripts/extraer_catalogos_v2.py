"""
extraer_catalogos_v2.py

Lee el Excel del docente (_Recursos_Practica_4.xlsx) y genera 6 CSVs en
oficial/datos_originales/csvs_v2/ listos para cargar con \\copy en
PostgreSQL siguiendo el schema v2 (rama Alex_2.0).

Decisiones clave:
- Hoja DistribucionTerritorial: la columna "Municipio" del Excel contiene
  PROVINCIAS (bug semántico ya conocido) y "Provincia" contiene MUNICIPIOS.
  Este script invierte el mapping para que la BD quede semánticamente
  correcta (9 deptos / 112 provincias / 340 municipios).
- codigo_provincia: hipótesis de 3 primeros dígitos de CodigoTerritorial
  (1 dígito depto + 2 dígitos índice provincia). Se verifica empíricamente:
  todos los CodigoTerritorial con el mismo prefijo de 3 chars deben
  mapear a la misma provincia. Si no, el script PARA.
- codigo_municipio: CodigoTerritorial completo (5 chars como string).
- Hoja Transcripciones (NUEVA): se filtran 45 actas con CodigoActa
  terminado en '0000000' (terminadores). El campo Observaciones se
  splittea por ":" y el primer segmento se mapea a una de las 9
  categorías del enum tipo_observacion_formal. Las filas con votos
  negativos NO se filtran acá: pasan al CSV con su valor original
  para que el ingestor las clasifique como INCONSISTENCIA_NUMERICA en
  log_inconsistencias (auditoría, no descarte silencioso).

Uso:
  python oficial/scripts/extraer_catalogos_v2.py
"""

from __future__ import annotations

import csv
import random
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Optional

from openpyxl import load_workbook

# ──────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT / "datos_originales" / "_Recursos_Practica_4.xlsx"
OUT_DIR = ROOT / "datos_originales" / "csvs_v2"

# ──────────────────────────────────────────────────────────────────────
# Mapeo fijo de departamentos (orden alfabético de la BD actual)
# ──────────────────────────────────────────────────────────────────────

DEPTO_CODIGO: dict[str, int] = {
    "Chuquisaca": 1,
    "La Paz": 2,
    "Cochabamba": 3,
    "Oruro": 4,
    "Potosí": 5,
    "Tarija": 6,
    "Santa Cruz": 7,
    "Beni": 8,
    "Pando": 9,
}

# Catálogo texto-del-docente → enum del schema
OBSERVACION_A_ENUM: dict[str, str] = {
    "Falta de datos de apertura o cierre": "FALTA_DATOS_APERTURA_CIERRE",
    "Mesa en lugar distinto": "MESA_LUGAR_DISTINTO",
    "Uso de formularios no oficiales": "USO_FORMULARIOS_NO_OFICIALES",
    "Papeletas no autorizadas": "PAPELETAS_NO_AUTORIZADAS",
    "Ausencia de delegados sin justificación": "AUSENCIA_DELEGADOS",
    "Fecha incorrecta": "FECHA_INCORRECTA",
    "Errores de transcripción": "ERRORES_TRANSCRIPCION",
    "Falta de firmas o huellas": "FALTA_FIRMAS_HUELLAS",
    "Inconsistencia aritmética": "INCONSISTENCIA_ARITMETICA",
}


def normalizar_categoria(s: str) -> str:
    """Quita acentos y baja a minúsculas para matching tolerante."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


OBSERVACION_NORM: dict[str, str] = {
    normalizar_categoria(k): v for k, v in OBSERVACION_A_ENUM.items()
}


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────


def fatal(msg: str) -> None:
    print(f"\n[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)


def fmt_codigo(value: object, width: int) -> str:
    """Convierte un valor float/int a string con N chars (zero-padded)."""
    if value is None:
        raise ValueError("codigo nulo")
    if isinstance(value, float):
        return str(int(value)).zfill(width)
    if isinstance(value, int):
        return str(value).zfill(width)
    s = str(value).strip()
    # quitar ".0" si vino como string
    if s.endswith(".0"):
        s = s[:-2]
    return s.zfill(width)


def to_int(value: object) -> int:
    if value is None:
        raise ValueError("entero nulo")
    if isinstance(value, (int, float)):
        return int(value)
    return int(str(value).strip())


def to_int_signed(value: object) -> int:
    """Como to_int pero permite valores negativos sin warning."""
    return to_int(value)


def clasificar_observacion(texto: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Recibe el campo Observaciones del Excel ("Tipo: descripción long").
    Devuelve (texto_completo, enum) o (None, None) si no hay observación.
    """
    if texto is None:
        return None, None
    s = str(texto).strip()
    if not s:
        return None, None
    primer = s.split(":", 1)[0].strip() if ":" in s else s
    enum = OBSERVACION_NORM.get(normalizar_categoria(primer))
    return s, enum


# ──────────────────────────────────────────────────────────────────────
# Hoja 1: DistribucionTerritorial
# ──────────────────────────────────────────────────────────────────────


def extraer_distribucion_territorial(wb) -> tuple[
    list[tuple[str, str, int]],          # provincias: (codigo, nombre, codigo_dep)
    list[tuple[str, str, str]],          # municipios: (codigo, nombre, codigo_prov)
    dict[str, str],                      # CodigoTerritorial → codigo_municipio
]:
    ws = wb["DistribucionTerritorial"]
    provincias_seen: dict[str, tuple[str, int]] = {}   # cod_prov → (nombre, cod_dep)
    municipios: list[tuple[str, str, str]] = []
    codigo_terr_a_muni: dict[str, str] = {}

    # Para validar la hipótesis de los 3 primeros chars
    prefijo_a_provincia: dict[str, str] = {}

    for row in ws.iter_rows(min_row=2, values_only=True):
        cod_terr_raw, depto_name, prov_name, muni_name = row[:4]
        if cod_terr_raw is None or depto_name is None:
            continue

        depto_name = str(depto_name).strip()
        prov_name = str(prov_name).strip() if prov_name is not None else ""
        muni_name = str(muni_name).strip() if muni_name is not None else ""

        if depto_name not in DEPTO_CODIGO:
            fatal(f"Departamento desconocido en Excel: {depto_name!r}")

        cod_dep = DEPTO_CODIGO[depto_name]
        cod_terr = fmt_codigo(cod_terr_raw, 5)
        cod_prov = cod_terr[:3]

        # Hipótesis: el prefijo de 3 chars debe mapear siempre al MISMO
        # par (depto, provincia). Si no, falla.
        if cod_prov in prefijo_a_provincia:
            esperado = prefijo_a_provincia[cod_prov]
            actual = f"{depto_name}|{prov_name}"
            if esperado != actual:
                fatal(
                    f"Hipótesis 3-chars rota: prefijo {cod_prov} aparece como "
                    f"{esperado!r} y también como {actual!r}"
                )
        else:
            prefijo_a_provincia[cod_prov] = f"{depto_name}|{prov_name}"

        provincias_seen.setdefault(cod_prov, (prov_name, cod_dep))
        municipios.append((cod_terr, muni_name, cod_prov))
        codigo_terr_a_muni[cod_terr] = cod_terr

    provincias_list = [
        (cod, nombre, cod_dep) for cod, (nombre, cod_dep) in provincias_seen.items()
    ]
    return provincias_list, municipios, codigo_terr_a_muni


# ──────────────────────────────────────────────────────────────────────
# Hoja 2: RecintosElectorales
# ──────────────────────────────────────────────────────────────────────


def extraer_recintos(wb, codigo_terr_a_muni: dict[str, str]) -> list[
    tuple[str, str, str, str]
]:
    """
    Devuelve filas (codigo_recinto, codigo_municipio, nombre, direccion).

    Estructura de la hoja RecintosElectorales (0-indexed):
      col 0: recintoCode       — ENGAÑOSO. Solo 340 valores únicos y vacío
                                 en 197 de 537 filas. NO usar como guard.
      col 1: CodigoTerritorial — 5 dígitos, FK al municipio. Siempre presente.
                                 Coincide exactamente con primeros 5 chars
                                 de CodigoRecinto en las 537 filas.
      col 2: CodigoRecinto     — 10 dígitos, PK del recinto. 537 únicos.
      col 3: RecintoNombre
      col 4: RecintoDireccion
      col 5: NumMesas          — IGNORADO (información implícita en ActasImpresas).
    """
    ws = wb["RecintosElectorales"]
    recintos: list[tuple[str, str, str, str]] = []
    seen: set[str] = set()
    descartados_sin_municipio = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        cod_recinto_raw = row[2]
        cod_terr_raw = row[1]
        nombre = row[3]
        direccion = row[4]

        # Guard: una fila es válida si tiene CodigoRecinto (col 2). col 0
        # se ignora porque está vacío en ~197 filas con datos válidos.
        if cod_recinto_raw is None or cod_terr_raw is None:
            continue

        cod_terr = fmt_codigo(cod_terr_raw, 5)
        if cod_terr not in codigo_terr_a_muni:
            descartados_sin_municipio += 1
            continue

        cod_recinto = fmt_codigo(cod_recinto_raw, 10)
        if cod_recinto in seen:
            continue
        seen.add(cod_recinto)

        recintos.append((
            cod_recinto,
            codigo_terr_a_muni[cod_terr],
            str(nombre or "").strip(),
            str(direccion or "").strip(),
        ))

    if descartados_sin_municipio:
        print(
            f"  [info] recintos descartados (codigo_municipio no existe): "
            f"{descartados_sin_municipio}"
        )
    return recintos


# ──────────────────────────────────────────────────────────────────────
# Hoja 3: ActasImpresas → mesas
# ──────────────────────────────────────────────────────────────────────


def extraer_mesas(wb, codigos_recinto: set[str]) -> list[tuple[str, str, int, int]]:
    """
    Devuelve filas (codigo_mesa, codigo_recinto, nro_mesa, votantes_habilitados).
    """
    ws = wb["ActasImpresas"]
    mesas: list[tuple[str, str, int, int]] = []
    seen: set[str] = set()
    descartados = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        cod_recinto_raw = row[0]
        cod_acta_raw = row[1]   # = codigo_mesa en este schema
        nro_mesa_raw = row[2]
        votantes_raw = row[3]

        if cod_recinto_raw is None or cod_acta_raw is None:
            descartados += 1
            continue

        cod_recinto = fmt_codigo(cod_recinto_raw, 10)
        cod_mesa = fmt_codigo(cod_acta_raw, 13)

        if cod_recinto not in codigos_recinto:
            descartados += 1
            continue

        if cod_mesa in seen:
            continue
        seen.add(cod_mesa)

        mesas.append((
            cod_mesa,
            cod_recinto,
            to_int(nro_mesa_raw or 0),
            to_int(votantes_raw or 0),
        ))

    if descartados:
        print(f"  [info] mesas descartadas (recinto no encontrado o nulo): {descartados}")
    return mesas


# ──────────────────────────────────────────────────────────────────────
# Hoja 4: Transcripciones
# ──────────────────────────────────────────────────────────────────────


def extraer_transcripciones(wb, codigos_mesa: set[str]) -> tuple[
    list[tuple],                # filas para CSV
    Counter,                    # conteo por categoría
    int,                        # filas con voto negativo
    int,                        # filas filtradas por terminador
    int,                        # filas filtradas por mesa inexistente
]:
    """
    Lee la hoja Transcripciones y devuelve filas para el CSV.
    Filtra:
      - 45 filas con CodigoActa terminando en '0000000' (terminadores).
      - filas con codigo_mesa que no existe en la BD (defensivo).
    NO filtra:
      - filas con votos negativos (se cargan tal cual; el ingestor las
        clasificará como INCONSISTENCIA_NUMERICA en runtime).
    """
    ws = wb["Transcripciones"]
    filas: list[tuple] = []
    cat_counter: Counter = Counter()
    negativos = 0
    filtrados_terminador = 0
    filtrados_mesa = 0

    HEADERS = (
        "CodigoTerritorial Departamento Provincia Municipio "
        "CodigoRecinto RecintoNombre RecintoDireccion NumMesas "
        "CodigoActa NroMesa VotantesHabilitados PapeletasAnfora "
        "PapeltasNoUtilizadas P1 P2 P3 P4 VotosValidos VotosBlancos "
        "VotosNulos Observaciones"
    ).split()

    # Posiciones esperadas (0-indexed) según inspección manual:
    POS = {h: i for i, h in enumerate(HEADERS)}

    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None or row[POS["CodigoActa"]] is None:
            continue

        cod_acta = fmt_codigo(row[POS["CodigoActa"]], 13)

        # Filtro 1: terminadores
        if cod_acta.endswith("0000000"):
            filtrados_terminador += 1
            continue

        # codigo_mesa = codigo_acta en este modelo (1 acta ↔ 1 mesa)
        cod_mesa = cod_acta
        if cod_mesa not in codigos_mesa:
            filtrados_mesa += 1
            continue

        try:
            habilitados = to_int(row[POS["VotantesHabilitados"]] or 0)
            anfora = to_int_signed(row[POS["PapeletasAnfora"]] or 0)
            no_usadas = to_int_signed(row[POS["PapeltasNoUtilizadas"]] or 0)
            p1 = to_int_signed(row[POS["P1"]] or 0)
            p2 = to_int_signed(row[POS["P2"]] or 0)
            p3 = to_int_signed(row[POS["P3"]] or 0)
            p4 = to_int_signed(row[POS["P4"]] or 0)
            blancos = to_int_signed(row[POS["VotosBlancos"]] or 0)
            nulos = to_int_signed(row[POS["VotosNulos"]] or 0)
        except (TypeError, ValueError) as exc:
            fatal(f"Acta {cod_acta}: error parseando enteros: {exc}")

        if any(v < 0 for v in (p1, p2, p3, p4, blancos, nulos, anfora, no_usadas)):
            negativos += 1

        obs_raw = row[POS["Observaciones"]]
        obs_text, obs_enum = clasificar_observacion(obs_raw)
        if obs_enum:
            cat_counter[obs_enum] += 1
        elif obs_text:
            cat_counter["__SIN_MATCH__"] += 1

        filas.append((
            cod_acta, cod_mesa,
            p1, p2, p3, p4,
            blancos, nulos,
            habilitados, anfora, no_usadas,
            obs_text or "",
            obs_enum or "",
        ))

    return filas, cat_counter, negativos, filtrados_terminador, filtrados_mesa


# ──────────────────────────────────────────────────────────────────────
# Escritura CSV
# ──────────────────────────────────────────────────────────────────────


def escribir_csv(path: Path, header: list[str], rows: list[tuple]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        for r in rows:
            w.writerow(r)


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────


def main() -> None:
    if not EXCEL_PATH.exists():
        fatal(f"No existe el Excel: {EXCEL_PATH}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[1/6] Abriendo Excel: {EXCEL_PATH.name}")
    wb = load_workbook(EXCEL_PATH, read_only=True, data_only=True)

    print("[2/6] Extrayendo DistribucionTerritorial …")
    provincias, municipios, codigo_terr_a_muni = extraer_distribucion_territorial(wb)
    print(f"      Hipótesis usada para codigo_provincia: primeros 3 chars de CodigoTerritorial")
    print(f"      Provincias detectadas: {len(provincias)}  (esperado 112)")
    print(f"      Municipios detectados: {len(municipios)} (esperado 340)")

    if len(provincias) != 112:
        fatal(f"Conteo de provincias != 112 ({len(provincias)})")
    if len(municipios) != 340:
        fatal(f"Conteo de municipios != 340 ({len(municipios)})")

    print("[3/6] Extrayendo RecintosElectorales …")
    recintos = extraer_recintos(wb, codigo_terr_a_muni)
    print(f"      Recintos detectados: {len(recintos)} (esperado 537)")
    if len(recintos) != 537:
        fatal(f"Conteo de recintos != 537 ({len(recintos)})")

    print("[4/6] Extrayendo ActasImpresas (mesas) …")
    mesas = extraer_mesas(wb, {r[0] for r in recintos})
    print(f"      Mesas detectadas: {len(mesas)} (esperado 5357)")
    if len(mesas) != 5357:
        print(
            f"      [warn] Conteo de mesas != 5357. Continúo para que veas el dato."
        )

    print("[5/6] Extrayendo Transcripciones …")
    transcripciones, cats, negativos, term, sin_mesa = extraer_transcripciones(
        wb, {m[0] for m in mesas}
    )
    print(f"      Transcripciones válidas: {len(transcripciones)}")
    print(f"      Filtradas por terminador '0000000':       {term}  (esperado 45)")
    print(f"      Filtradas por mesa inexistente:           {sin_mesa}")
    print(f"      Filas con al menos un voto negativo:      {negativos}  (esperado ≈183)")
    print(f"      Distribución de tipo_observacion_formal:")
    for cat, n in cats.most_common():
        print(f"        {cat:32s}  {n}")

    # ── Departamentos
    deptos_rows = sorted(
        ((cod, name) for name, cod in DEPTO_CODIGO.items()),
        key=lambda x: x[0],
    )

    print("[6/6] Escribiendo CSVs …")
    escribir_csv(OUT_DIR / "departamentos.csv", ["codigo", "nombre"], deptos_rows)
    escribir_csv(
        OUT_DIR / "provincias.csv",
        ["codigo", "nombre", "codigo_departamento"],
        sorted(provincias, key=lambda x: x[0]),
    )
    escribir_csv(
        OUT_DIR / "municipios.csv",
        ["codigo", "nombre", "codigo_provincia"],
        sorted(municipios, key=lambda x: x[0]),
    )
    escribir_csv(
        OUT_DIR / "recintos.csv",
        ["codigo_recinto", "codigo_municipio", "nombre", "direccion"],
        recintos,
    )
    escribir_csv(
        OUT_DIR / "mesas.csv",
        ["codigo_mesa", "codigo_recinto", "nro_mesa", "votantes_habilitados"],
        mesas,
    )
    escribir_csv(
        OUT_DIR / "transcripciones.csv",
        [
            "codigo_acta", "codigo_mesa",
            "votos_p1", "votos_p2", "votos_p3", "votos_p4",
            "blancos", "nulos",
            "habilitados", "anfora", "no_usadas",
            "observacion_formal", "tipo_observacion_formal",
        ],
        transcripciones,
    )

    print("\n=== Resumen final ===")
    for name in [
        "departamentos.csv", "provincias.csv", "municipios.csv",
        "recintos.csv", "mesas.csv", "transcripciones.csv",
    ]:
        path = OUT_DIR / name
        n = sum(1 for _ in path.open(encoding="utf-8")) - 1
        print(f"  {name:24s}  {n:6d} filas  ({path.stat().st_size:>8d} bytes)")

    print("\n=== Muestras aleatorias (5 por archivo) ===")
    rng = random.Random(42)
    for name, rows in [
        ("departamentos", deptos_rows),
        ("provincias", provincias),
        ("municipios", municipios),
        ("recintos", recintos),
        ("mesas", mesas),
        ("transcripciones", transcripciones),
    ]:
        print(f"\n  {name}:")
        muestra = rng.sample(rows, min(5, len(rows)))
        for m in muestra:
            print(f"    {m}")

    print("\n[OK] Extracción completada.")


if __name__ == "__main__":
    main()
