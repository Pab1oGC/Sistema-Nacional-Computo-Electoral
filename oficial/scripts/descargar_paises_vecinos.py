"""
descargar_paises_vecinos.py

Descarga countries.geojson público y filtra los 6 países que comparten
frontera con Bolivia (incluyendo Bolivia para que sirva de referencia
visual en el mapa). Output: dashboard-oficial/public/geo/sudamerica-vecinos.geojson

Uso:
  python oficial/scripts/descargar_paises_vecinos.py
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dashboard-oficial" / "public" / "geo" / "sudamerica-vecinos.geojson"

URLS_INTENTAR = [
    "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
    "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json",
]

PAISES_VECINOS = {"Brazil", "Peru", "Chile", "Argentina", "Paraguay", "Bolivia"}


def main() -> None:
    data = None
    for url in URLS_INTENTAR:
        print(f"[1/3] Intentando {url} …")
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (oficial-tools)"},
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
            print(f"      OK · features totales: {len(data['features'])}")
            break
        except Exception as exc:
            print(f"      Falló: {exc}")
    if data is None:
        raise SystemExit("[FATAL] No se pudo descargar de ninguna URL.")

    # Filtrado tolerante: el campo del nombre puede ser ADMIN, name, NAME,
    # name_long, etc. según la fuente.
    features_filtrados = []
    encontrados: set[str] = set()
    candidatos_props = ["ADMIN", "name", "NAME", "name_long", "NAME_LONG"]
    for f in data["features"]:
        props = f.get("properties", {})
        nombre = None
        for k in candidatos_props:
            v = props.get(k)
            if v and v in PAISES_VECINOS:
                nombre = v
                break
        if nombre:
            f["properties"] = {"name": nombre}
            features_filtrados.append(f)
            encontrados.add(nombre)

    faltantes = PAISES_VECINOS - encontrados
    print(
        f"[2/3] Países encontrados: {len(features_filtrados)} de {len(PAISES_VECINOS)}"
    )
    if faltantes:
        print(f"      Faltantes: {sorted(faltantes)}")

    output = {"type": "FeatureCollection", "features": features_filtrados}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = OUT.stat().st_size / 1024
    print(f"[3/3] Escrito {OUT.name} ({size_kb:.1f} KB)")
    print("[OK]")


if __name__ == "__main__":
    main()
