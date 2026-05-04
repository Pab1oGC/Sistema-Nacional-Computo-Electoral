"""Tests del FakeProvinciaRepository.

Smoke test del fake usado en tests del Application layer.
"""

import pytest

from recuento_oficial.domain.entities.provincia import Provincia
from tests.unit.fakes.fake_provincia_repository import FakeProvinciaRepository


@pytest.fixture
def repo_con_4_provincias() -> FakeProvinciaRepository:
    repo = FakeProvinciaRepository()
    repo.add(Provincia(codigo="101", nombre="Oropeza", codigo_departamento=1))
    repo.add(Provincia(codigo="102", nombre="Azurduy", codigo_departamento=1))
    repo.add(Provincia(codigo="201", nombre="Murillo", codigo_departamento=2))
    repo.add(Provincia(codigo="901", nombre="Nicolás Suárez", codigo_departamento=9))
    return repo


class TestFakeProvinciaRepository:
    async def test_list_all_ordena_por_depto_y_codigo(
        self, repo_con_4_provincias: FakeProvinciaRepository
    ) -> None:
        provincias = await repo_con_4_provincias.list_all()
        codigos = [p.codigo for p in provincias]
        assert codigos == ["101", "102", "201", "901"]

    async def test_by_codigo_existente(
        self, repo_con_4_provincias: FakeProvinciaRepository
    ) -> None:
        prov = await repo_con_4_provincias.by_codigo("201")
        assert prov is not None
        assert prov.nombre == "Murillo"
        assert prov.codigo_departamento == 2

    async def test_by_codigo_inexistente(
        self, repo_con_4_provincias: FakeProvinciaRepository
    ) -> None:
        prov = await repo_con_4_provincias.by_codigo("999")
        assert prov is None

    async def test_list_by_departamento_chuquisaca(
        self, repo_con_4_provincias: FakeProvinciaRepository
    ) -> None:
        provincias = await repo_con_4_provincias.list_by_departamento(1)
        assert len(provincias) == 2
        nombres = sorted(p.nombre for p in provincias)
        assert nombres == ["Azurduy", "Oropeza"]

    async def test_list_by_departamento_inexistente(
        self, repo_con_4_provincias: FakeProvinciaRepository
    ) -> None:
        provincias = await repo_con_4_provincias.list_by_departamento(99)
        assert provincias == []
