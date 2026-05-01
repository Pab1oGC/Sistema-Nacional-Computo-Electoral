"""
Carga el catálogo electoral desde el Excel a MongoDB.
Crea/reemplaza las colecciones: distribucion_territorial, recintos_electorales, mesas_actas.

Uso:
    pip install pymongo openpyxl
    python seed_catalogo.py
"""

import sys
from pathlib import Path
import openpyxl
from pymongo import MongoClient, WriteConcern

EXCEL_PATH = Path(__file__).parent / "actas" / "Recursos Practica 4.xlsx"
MONGO_URI  = "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/rrv_db?replicaSet=rrv-rs"
DB_NAME    = "rrv_db"

# w="majority" → MongoDB confirma que la escritura llegó a ≥2 nodos del RS
# antes de responder. Garantiza que el catálogo esté sincronizado en el cluster.
WC_MAJORITY = WriteConcern(w="majority", j=True)


def load_sheet(wb, name: str) -> list[tuple]:
    ws   = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    return rows[0], rows[1:]   # headers, data


def seed_distribucion(db, headers, rows):
    docs = [
        {
            "codigo_territorial": int(r[0]),
            "departamento":       r[1],
            "municipio":          r[2],
            "provincia":          r[3],
        }
        for r in rows if r[0] is not None
    ]
    col = db["distribucion_territorial"]
    col.drop()
    col.create_index("codigo_territorial", unique=True)
    col.insert_many(docs, ordered=False)
    print(f"  distribucion_territorial: {len(docs)} registros")


def seed_recintos(db, headers, rows):
    docs = [
        {
            "codigo_recinto":     int(r[2]),
            "codigo_territorial": int(r[1]),
            "nombre":             r[3],
            "direccion":          r[4],
            "num_mesas":          int(r[5]) if r[5] else 0,
        }
        for r in rows if r[2] is not None
    ]
    col = db["recintos_electorales"]
    col.drop()
    col.create_index("codigo_recinto", unique=True)
    col.insert_many(docs, ordered=False)
    print(f"  recintos_electorales:     {len(docs)} registros")


def seed_mesas(db, headers, rows):
    docs = [
        {
            "codigo_acta":    int(r[1]),
            "codigo_recinto": int(r[0]),
            "nro_mesa":       int(r[2]),
            "habilitados":    int(r[3]) if r[3] else 0,
        }
        for r in rows if r[1] is not None
    ]
    col = db["mesas_actas"]
    col.drop()
    col.create_index("codigo_acta", unique=True)
    col.create_index("codigo_recinto")
    try:
        col.insert_many(docs, ordered=False)
    except Exception as e:
        # ordered=False continúa ante duplicados; reportamos cuántos se insertaron
        inserted = col.count_documents({})
        print(f"  mesas_actas:              {inserted} registros ({len(docs) - inserted} duplicados omitidos)")
        return
    print(f"  mesas_actas:              {len(docs)} registros")


def main():
    if not EXCEL_PATH.exists():
        print(f"ERROR: No se encontró {EXCEL_PATH}")
        sys.exit(1)

    print(f"Leyendo {EXCEL_PATH.name}...")
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)

    # Desde el host, mongo1/2/3 resuelven a 127.0.0.1 pero en puertos distintos.
    # El primario puede cambiar tras reinicios → detectamos cuál es probando los 3.
    PORT_MAP = [("mongo1", 27017), ("mongo2", 27018), ("mongo3", 27019)]
    client = None
    primary_name = None

    print("Buscando el primario del Replica Set...")
    for name, port in PORT_MAP:
        try:
            c = MongoClient(
                f"mongodb://localhost:{port}",
                directConnection=True,
                serverSelectionTimeoutMS=3000,
            )
            info = c.admin.command("isMaster")
            role = "PRIMARY" if info.get("ismaster") else "SECONDARY"
            print(f"  {name}:{port} → {role}")
            if info.get("ismaster"):
                client = c
                primary_name = f"{name}:{port}"
            else:
                c.close()
        except Exception as e:
            print(f"  {name}:{port} → ERROR ({e})")

    if client is None:
        print("ERROR: No se encontró ningún primario")
        sys.exit(1)

    print(f"\n  Conectado al primario: {primary_name}")
    db = client.get_database(DB_NAME, write_concern=WC_MAJORITY)
    print()

    h, rows = load_sheet(wb, "DistribucionTerritorial")
    seed_distribucion(db, h, rows)

    h, rows = load_sheet(wb, "RecintosElectorales")
    seed_recintos(db, h, rows)

    h, rows = load_sheet(wb, "ActasImpresas")
    seed_mesas(db, h, rows)

    print("\nSeed completado.")
    client.close()


if __name__ == "__main__":
    main()
