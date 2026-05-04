"""Smoke test del agregado por provincia en FakeActaOficialRepository.

El use case que consume aggregate_resultados_por_provincia es 3B/futuro.
Este test verifica el contrato del repository (preseed → resultado).
"""

from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoProvincia,
)
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository


class TestAggregateResultadosPorProvincia:
    async def test_devuelve_provincias_preseed_para_depto(self) -> None:
        repo = FakeActaOficialRepository()
        repo.set_provincia_aggregates(
            1,
            [
                ResultadoProvincia(
                    codigo_provincia="101",
                    nombre_provincia="Oropeza",
                    total_mesas_provincia=120,
                    actas_validadas_provincia=100,
                    votos_p1=500,
                    votos_p2=300,
                    votos_p3=150,
                    votos_p4=50,
                ),
                ResultadoProvincia(
                    codigo_provincia="102",
                    nombre_provincia="Azurduy",
                    total_mesas_provincia=15,
                    actas_validadas_provincia=0,
                    votos_p1=0,
                    votos_p2=0,
                    votos_p3=0,
                    votos_p4=0,
                ),
            ],
        )

        provincias = await repo.aggregate_resultados_por_provincia(1)

        assert len(provincias) == 2
        oropeza = provincias[0]
        assert oropeza.codigo_provincia == "101"
        assert oropeza.nombre_provincia == "Oropeza"
        assert oropeza.actas_validadas_provincia == 100
        azurduy = provincias[1]
        assert azurduy.actas_validadas_provincia == 0

    async def test_depto_sin_preseed_devuelve_vacio(self) -> None:
        repo = FakeActaOficialRepository()
        provincias = await repo.aggregate_resultados_por_provincia(99)
        assert provincias == []
