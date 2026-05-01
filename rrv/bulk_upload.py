"""
Carga masiva de PDFs al endpoint POST /api/v1/actas/foto.

Nombre de archivo esperado: acta_CCCCCRRRRRMMM.pdf
  CCCCC = codigo_distribucion_territorial (5 dígitos)
  RRRRR = codigo_recinto                  (5 dígitos, se convierte a int)
  MMM   = nro_mesa / codigo_mesa          (3 dígitos, se convierte a int)

Uso:
    pip install requests
    python bulk_upload.py [--api http://localhost:8000] [--delay 0.5] [--dir actas]
"""

import argparse
import sys
import time
from pathlib import Path

import requests

PATTERN = "acta_*.pdf"


def parse_filename(pdf: Path) -> tuple[str, int, int] | None:
    stem = pdf.stem  # "acta_1010200001001"
    if not stem.startswith("acta_"):
        return None
    digits = stem[5:]
    if len(digits) != 13 or not digits.isdigit():
        return None
    territorial = digits[0:5]
    recinto     = int(digits[5:10])
    mesa        = int(digits[10:13])
    return territorial, recinto, mesa


def upload(pdf: Path, api_base: str) -> dict:
    parsed = parse_filename(pdf)
    if parsed is None:
        return {"ok": False, "reason": "nombre de archivo no válido"}

    territorial, recinto, mesa = parsed
    url = f"{api_base.rstrip('/')}/api/v1/actas/foto"

    with pdf.open("rb") as f:
        resp = requests.post(
            url,
            files={"file": (pdf.name, f, "application/pdf")},
            data={
                "codigo_mesa":                    mesa,
                "codigo_recinto":                 recinto,
                "codigo_distribucion_territorial": territorial,
            },
            timeout=120,
        )

    if resp.status_code in (200, 202):
        return {"ok": True, "status": resp.status_code, "body": resp.json()}
    return {"ok": False, "status": resp.status_code, "body": resp.text}


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk upload de actas PDF al RRV API")
    parser.add_argument("--api",   default="http://localhost:8000", help="Base URL del API")
    parser.add_argument("--delay", type=float, default=0.3,         help="Segundos entre requests")
    parser.add_argument("--dir",   default="actas",                 help="Directorio con los PDFs")
    args = parser.parse_args()

    actas_dir = Path(__file__).parent / args.dir
    if not actas_dir.exists():
        print(f"ERROR: directorio '{actas_dir}' no encontrado")
        sys.exit(1)

    pdfs = sorted(actas_dir.glob(PATTERN))
    if not pdfs:
        print(f"No se encontraron archivos con patrón '{PATTERN}' en {actas_dir}")
        sys.exit(0)

    print(f"API:      {args.api}")
    print(f"Directorio: {actas_dir}")
    print(f"Archivos:   {len(pdfs)}")
    print("-" * 60)

    ok = err = skip = 0

    for i, pdf in enumerate(pdfs, 1):
        result = upload(pdf, args.api)

        if result["ok"]:
            body = result["body"]
            already = body.get("already_processed", False)
            if already:
                skip += 1
                tag = "SKIP (ya procesada)"
            else:
                ok += 1
                tag = f"OK   [{result['status']}]"
        else:
            err += 1
            tag = f"ERR  [{result.get('status', '?')}] {result.get('body', '')[:80]}"

        print(f"[{i:>4}/{len(pdfs)}] {pdf.name}  →  {tag}")

        if args.delay > 0 and i < len(pdfs):
            time.sleep(args.delay)

    print("-" * 60)
    print(f"Resultado: {ok} enviadas | {skip} ya procesadas | {err} errores")


if __name__ == "__main__":
    main()
