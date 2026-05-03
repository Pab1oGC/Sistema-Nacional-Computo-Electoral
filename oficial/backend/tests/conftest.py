"""Fixtures compartidas de pytest.

Tests de integración se saltean si DB_URL_TEST no está seteada.
"""

import json
import os
from pathlib import Path
from typing import Any

import pytest


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def acta_ground_truth() -> dict[str, Any]:
    """Acta 1010200001001 con habilitados=877, anfora=788, no_usadas=89.

    Suma de control: 788 + 89 = 877. Acta consistente, debe pasar Error1 y Error2.
    """
    with open(FIXTURES_DIR / "acta_1010200001001.json", encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
    return data


def _has_test_db() -> bool:
    return bool(os.environ.get("DB_URL_TEST"))


requires_db = pytest.mark.skipif(
    not _has_test_db(),
    reason="DB_URL_TEST no seteada (test de integración requiere PostgreSQL real)",
)
