"""
generar_provincias_geojson.py

Genera bolivia-provincias.geojson disolviendo (unary_union) los municipios
de bolivia-municipios.geojson (GADM nivel 3) agrupados por NAME_2 (que es
la provincia en GADM).

Hace matching por nombre normalizado (lowercase, sin espacios ni acentos)
contra el catálogo provincias.csv para obtener codigo_provincia y
codigo_departamento de la BD del oficial.

Output: oficial/dashboard-oficial/public/geo/bolivia-provincias.geojson
        con 112 features. Cada feature tiene properties:
          codigo_provincia, nombre, codigo_departamento

Uso:
  pip install shapely
  python oficial/scripts/generar_provincias_geojson.py
"""

from __future__ import annotations

import csv
import json
import unicodedata
from collections import defaultdict
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO_MUNI = ROOT / "dashboard-oficial" / "public" / "geo" / "bolivia-municipios.geojson"
GEO_PROV_OUT = ROOT / "dashboard-oficial" / "public" / "geo" / "bolivia-provincias.geojson"
PROVINCIAS_CSV = ROOT / "datos_originales" / "csvs_v2" / "provincias.csv"


def normalizar(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().replace(" ", "").replace("-", "").replace(".", "").strip()


DEPTO_GADM_A_CODIGO: dict[str, int] = {
    "chuquisaca": 1,
    "lapaz": 2,
    "cochabamba": 3,
    "oruro": 4,
    "potosi": 5,
    "tarija": 6,
    "santacruz": 7,
    "beni": 8,
    "pando": 9,
}


def main() -> None:
    # 1. Cargar catálogo de provincias de la BD: nombre → (codigo, codigo_dep).
    bd_provincias: dict[str, tuple[str, int]] = {}
    bd_provincias_norm: dict[str, tuple[str, str, int]] = {}
    with PROVINCIAS_CSV.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cod_prov = row["codigo"]
            nombre = row["nombre"]
            cod_dep = int(row["codigo_departamento"])
            bd_provincias[nombre] = (cod_prov, cod_dep)
            bd_provincias_norm[normalizar(nombre)] = (cod_prov, nombre, cod_dep)
    print(f"[1/5] Catálogo BD cargado: {len(bd_provincias)} provincias")

    # 2. Cargar GeoJSON GADM nivel 3 (municipios).
    with GEO_MUNI.open(encoding="utf-8") as f:
        municipios_geo = json.load(f)
    print(f"[2/5] GeoJSON municipios: {len(municipios_geo['features'])} features")

    # 3. Agrupar municipios GADM por (NAME_1, NAME_2) — depto + provincia.
    #    NAME_1 ej: 'LaPaz', 'SantaCruz', 'Beni'. Se normaliza para match.
    grupos: dict[tuple[str, str], list] = defaultdict(list)
    for feature in municipios_geo["features"]:
        props = feature["properties"]
        name1 = str(props.get("NAME_1", "")).strip()
        name2 = str(props.get("NAME_2", "")).strip()
        if not name1 or not name2:
            continue
        grupos[(name1, name2)].append(shape(feature["geometry"]))
    print(f"[3/5] Grupos (depto, provincia) GADM: {len(grupos)}")

    # 4. Para cada grupo, hacer dissolve y matchear con BD por nombre normalizado.
    features_prov: list[dict] = []
    sin_match: list[tuple[str, str]] = []
    for (name1, name2), geometrias in sorted(grupos.items()):
        union_geo = unary_union(geometrias)
        norm = normalizar(name2)
        match = bd_provincias_norm.get(norm)
        # codigo_departamento siempre se deriva del NAME_1 GADM, así
        # las features sin match igual son filtrables por depto en el mapa.
        cod_dep_gadm = DEPTO_GADM_A_CODIGO.get(normalizar(name1), 0)
        if match is None:
            sin_match.append((name1, name2))
            cod_provincia = f"X-{cod_dep_gadm}-{norm[:6]}"
            nombre_final = name2
            cod_dep = cod_dep_gadm
        else:
            cod_provincia, nombre_final, cod_dep = match
            # Si el match-por-nombre dio cod_dep distinto al GADM, prefiero
            # el GADM (geográfico = autoridad). Igual loguearlo.
            if cod_dep_gadm and cod_dep_gadm != cod_dep:
                print(
                    f"  [info] mismatch depto: BD={cod_dep} GADM={cod_dep_gadm} "
                    f"para {name2}"
                )
                cod_dep = cod_dep_gadm

        features_prov.append({
            "type": "Feature",
            "geometry": mapping(union_geo),
            "properties": {
                "codigo_provincia": cod_provincia,
                "nombre": nombre_final,
                "codigo_departamento": cod_dep,
                "_gadm_name1": name1,
                "_gadm_name2": name2,
            },
        })

    if sin_match:
        print(f"[WARN] Provincias GADM sin match en BD: {len(sin_match)}")
        for n1, n2 in sin_match[:10]:
            print(f"        - GADM: {n1} / {n2}")

    print(f"[4/5] Features generadas: {len(features_prov)} (esperado 112)")
    if len(features_prov) != 112:
        print(f"[WARN] Conteo distinto a 112")

    # 5. Escribir output (compacto, sin pretty-print, para tamaño bajo).
    output = {"type": "FeatureCollection", "features": features_prov}
    with GEO_PROV_OUT.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = GEO_PROV_OUT.stat().st_size / 1024
    print(
        f"[5/5] Escrito {GEO_PROV_OUT.name} ({size_kb:.1f} KB)"
    )
    print("[OK]")


if __name__ == "__main__":
    main()
