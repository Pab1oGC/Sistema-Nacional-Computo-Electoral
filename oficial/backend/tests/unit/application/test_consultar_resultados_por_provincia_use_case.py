"""Tests del use case ConsultarResultadosPorProvinciaUseCase con fakes."""

import pytest

from recuento_oficial.application.use_cases.consultar_resultados_por_provincia_use_case import (
    ConsultarResultadosPorProvinciaUseCase,
)
from recuento_oficial.domain.entities.departamento import Departamento
from recuento_oficial.domain.exceptions import DepartamentoNoExisteException
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoProvincia,
)
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository
from tests.unit.fakes.fake_partido_repository import FakePartidoRepository


def _build_use_case() -> tuple[
    ConsultarResultadosPorProvinciaUseCase,
    FakeActaOficialRepository,
]:
    acta_repo = FakeActaOficialRepository()
    partido_repo = FakePartidoRepository()
    use_case = ConsultarResultadosPorProvinciaUseCase(acta_repo, partido_repo)
    return use_case, acta_repo


class TestConsultarResultadosPorProvinciaUseCase:
    async def test_happy_path_un_depto_con_tres_provincias(self) -> None:
        use_case, acta_repo = _build_use_case()
        acta_repo.set_departamento(
            1, Departamento(codigo=1, nombre="Chuquisaca")
        )
        acta_repo.set_provincia_aggregates(
            1,
            [
                # Oropeza con dominancia P1 (40%)
                ResultadoProvincia(
                    codigo_provincia="101",
                    nombre_provincia="Oropeza",
                    total_mesas_provincia=120,
                    actas_validadas_provincia=96,
                    votos_p1=400,
                    votos_p2=300,
                    votos_p3=200,
                    votos_p4=100,
                ),
                # Azurduy sin actas: ganador None, porcentajes en 0
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
                # Zudáñez con P3 ganando
                ResultadoProvincia(
                    codigo_provincia="105",
                    nombre_provincia="Zudáñez",
                    total_mesas_provincia=20,
                    actas_validadas_provincia=20,
                    votos_p1=50,
                    votos_p2=40,
                    votos_p3=300,
                    votos_p4=10,
                ),
            ],
        )

        result = await use_case.execute(1)

        assert result.departamento.codigo == 1
        assert result.departamento.nombre == "Chuquisaca"
        assert len(result.provincias) == 3

        oropeza = result.provincias[0]
        assert oropeza.codigo_provincia == "101"
        assert oropeza.nombre_provincia == "Oropeza"
        assert oropeza.total_mesas_provincia == 120
        assert oropeza.actas_validadas_provincia == 96
        assert oropeza.porcentaje_avance_provincia == 80.0
        # Total válidos = 1000. P1 gana con 400 (40%)
        assert oropeza.ganador is not None
        assert oropeza.ganador.sigla_candidato == "P1"
        assert oropeza.ganador.votos == 400
        assert oropeza.ganador.porcentaje == 40.0
        # Orden de papeleta P1..P4
        siglas = [c.sigla_candidato for c in oropeza.resultados_candidatos]
        assert siglas == ["P1", "P2", "P3", "P4"]

        azurduy = result.provincias[1]
        assert azurduy.actas_validadas_provincia == 0
        assert azurduy.porcentaje_avance_provincia == 0.0
        assert azurduy.ganador is None

        zudañez = result.provincias[2]
        assert zudañez.ganador is not None
        assert zudañez.ganador.sigla_candidato == "P3"
        assert zudañez.ganador.votos == 300
        # Total válidos = 400. P3 gana con 300 (75%)
        assert zudañez.ganador.porcentaje == 75.0

    async def test_depto_inexistente_lanza_excepcion(self) -> None:
        use_case, _ = _build_use_case()
        # No preset departamentos → todos retornan None desde el fake.

        with pytest.raises(DepartamentoNoExisteException) as exc:
            await use_case.execute(99)
        assert "99" in str(exc.value)
        assert "no existe en el catálogo OEP" in str(exc.value)
