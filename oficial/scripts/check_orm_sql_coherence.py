"""Verifica que cada columna definida en los ORM models existe en
01-schema.sql con el mismo nombre.

Uso:
    python3.11 scripts/check_orm_sql_coherence.py

(correr desde la raíz de oficial/, o desde cualquier lugar — el path
de la raíz se resuelve relativo a este archivo.)

Detecta drift entre el SQL hand-written (fuente de verdad) y los ORM
models de SQLAlchemy. Recorrer cada `*_orm.py` en
backend/src/recuento_oficial/infrastructure/persistence/models/, extrae
nombre de tabla y columnas declaradas con `Mapped[...]`, y verifica que
aparezcan en sql/01-schema.sql con el mismo nombre.

No valida tipos ni constraints; solo presencia del identifier.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Schema v2 es la fuente de verdad desde rama Alex_2.0.
SCHEMA_SQL = (ROOT / "sql" / "01-schema-v2.sql").read_text(encoding="utf-8")

ORM_FILES = list((ROOT / "backend" / "src" / "recuento_oficial" /
                  "infrastructure" / "persistence" / "models").glob("*_orm.py"))

# Mapping: tablename → expected columns (extraído del ORM)
table_columns: dict[str, list[str]] = {}
table_pattern = re.compile(r'__tablename__\s*=\s*"(?P<name>[a-z_]+)"')
column_pattern = re.compile(
    r'^\s+(?P<col>[a-z_][a-z_0-9]*)\s*:\s*Mapped\[', re.MULTILINE
)

for orm_file in ORM_FILES:
    if "__init__" in orm_file.name:
        continue
    src = orm_file.read_text(encoding="utf-8")
    table_match = table_pattern.search(src)
    if not table_match:
        continue
    table = table_match.group("name")
    cols = column_pattern.findall(src)
    table_columns[table] = cols

print("ORM tablas detectadas:", len(table_columns))
print()

errores = 0
for table, cols in sorted(table_columns.items()):
    print(f"oficial.{table}:")
    # Verificar que la tabla aparece en el SQL
    if f"oficial.{table}" not in SCHEMA_SQL:
        print(f"  !! Tabla NO encontrada en 01-schema.sql")
        errores += 1
        continue
    # Verificar cada columna
    # Buscamos el bloque CREATE TABLE específico
    create_match = re.search(
        rf"CREATE TABLE (?:IF NOT EXISTS )?oficial\.{table}\s*\((?P<body>.*?)\);",
        SCHEMA_SQL,
        re.DOTALL,
    )
    if not create_match:
        print(f"  !! CREATE TABLE no parseable")
        errores += 1
        continue
    body = create_match.group("body")
    for col in cols:
        # Buscar la columna como inicio de línea (con tabulación)
        if re.search(rf"^\s+{re.escape(col)}\s+", body, re.MULTILINE):
            print(f"  ok  {col}")
        else:
            print(f"  !!  {col}  NO encontrada en CREATE TABLE")
            errores += 1
    print()

print(f"Total inconsistencias: {errores}")
sys.exit(0 if not errores else 1)
