"""Tests de integración del endpoint POST /recuento.

Se saltean si DB_URL_TEST no está seteada. Para activarlos:

    export DB_URL_TEST=postgresql+asyncpg://postgres:postgres@localhost:5433/oficial_test
    pytest tests/integration/

Asume que la BD `oficial_test` existe con el schema cargado.
"""

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import requires_db


@requires_db
@pytest.mark.integration
class TestRecuentoApi:
    async def test_post_recuento_devuelve_201_con_acta_consistente(
        self, acta_ground_truth: dict[str, Any]
    ) -> None:
        # Importación tardía para no fallar la colección si las deps no están
        from main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            r = await client.post(
                "/api/v1/oficial/recuento", json=acta_ground_truth
            )

        assert r.status_code == 201, r.text
        body = r.json()
        assert body["codigo_acta"] == "1010200001001"
        assert body["tipo"] == "FORM"

    async def test_post_recuento_duplicado_devuelve_409(
        self, acta_ground_truth: dict[str, Any]
    ) -> None:
        from main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            r1 = await client.post(
                "/api/v1/oficial/recuento", json=acta_ground_truth
            )
            assert r1.status_code in (201, 409)
            r2 = await client.post(
                "/api/v1/oficial/recuento", json=acta_ground_truth
            )

        assert r2.status_code == 409
        assert "ya ha sido procesada en la BDD TREP/OFICIAL" in r2.json()["detail"]

    async def test_post_recuento_acta_inconsistente_devuelve_422(
        self, acta_ground_truth: dict[str, Any]
    ) -> None:
        from main import app

        payload = {**acta_ground_truth, "codigo_acta": "9999999999999", "anfora": 787}
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            r = await client.post("/api/v1/oficial/recuento", json=payload)

        assert r.status_code == 422
        detail = r.json()["detail"]
        assert isinstance(detail, list)
        assert any("papeletas no usadas" in m for m in detail)
