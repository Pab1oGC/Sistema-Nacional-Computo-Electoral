"""Validador rápido de sintaxis SQL con pglast.

Uso:
    python3.11 scripts/check_sql_syntax.py

(correr desde la raíz de oficial/)

Verifica que sql/01-schema.sql, sql/04-carga-datos.sql y sql/05-consultas.sql
tengan sintaxis SQL válida según pglast (libpg_query). Filtra líneas con
meta-comandos psql (\\copy, \\d, etc.) que no son SQL puro y rompen el parser.

Requiere: pip install --user pglast
"""
from __future__ import annotations

import sys
from pathlib import Path

import pglast

# Resolver paths relativos a la raíz del módulo oficial/, no al CWD del shell
ROOT = Path(__file__).resolve().parent.parent

FILES = [
    ROOT / "sql" / "01-schema.sql",
    ROOT / "sql" / "04-carga-datos.sql",
    ROOT / "sql" / "05-consultas.sql",
]

errores: list[tuple[str, str]] = []
for f in FILES:
    src = f.read_text(encoding="utf-8")
    cleaned_lines = [
        line for line in src.split("\n") if not line.lstrip().startswith("\\")
    ]
    cleaned = "\n".join(cleaned_lines)
    rel = f.relative_to(ROOT)
    try:
        pglast.parse_sql(cleaned)
        print(f"  OK   {rel}")
    except Exception as exc:
        errores.append((str(rel), str(exc)[:300]))
        print(f"  FAIL {rel}: {str(exc)[:300]}")

print(f"Total errores: {len(errores)}")
sys.exit(0 if not errores else 1)
