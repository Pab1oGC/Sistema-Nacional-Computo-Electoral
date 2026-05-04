"""Tests del use case ConsultarResultadosPorMunicipioUseCase con fakes."""

import pytest

from recuento_oficial.application.use_cases.consultar_resultados_por_municipio_use_case import (
    ConsultarResultadosPorMunicipioUseCase,
)
from recuento_oficial.domain.entities.departamento import Departamento
from recuento_oficial.domain.exceptions import DepartamentoNoExisteException
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoMunicipio,
)
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository
from tests.unit.fakes.fake_partido_repository import FakePartidoRepository


def _build_use_case() -> tuple[
    ConsultarResultadosPorMunicipioUseCase,
    FakeActaOficialRepository,
]:
    acta_repo = FakeActaOficialRepository()
    partido_repo = FakePartidoRepository()
    use_case = ConsultarResultadosPorMunicipioUseCase(acta_repo, partido_repo)
    return use_case, acta_repo


class TestConsultarResultadosPorMunicipioUseCase:
    async def test_happy_path_un_depto_con_dos_municipios(self) -> None:
        use_case, acta_repo = _build_use_case()
        acta_repo.set_departamento(
            1, Departamento(codigo=1, nombre="Chuquisaca")
        )
        acta_repo.set_municipio_aggregates(
            1,
            [
                ResultadoMunicipio(
                    codigo_municipio="10101",
                    nombre_municipio="Sucre",
                    total_mesas_municipio=50,
                    actas_validadas_municipio=40,
                    votos_p1=400,
                    votos_p2=300,
                    votos_p3=200,
                    votos_p4=100,
                ),
                ResultadoMunicipio(
                    codigo_municipio="10102",
                    nombre_municipio="Yotala",
                    total_mesas_municipio=10,
                    actas_validadas_municipio=0,
                    votos_p1=0,
                    votos_p2=0,
                    votos_p3=0,
                    votos_p4=0,
                ),
            ],
        )

        result = await use_case.execute(1)

        assert result.departamento.codigo == 1
        assert result.departamento.nombre == "Chuquisaca"
        assert len(result.municipios) == 2

        sucre = result.municipios[0]
        assert sucre.codigo_municipio == "10101"
        assert sucre.id_municipio == 10101
        assert sucre.nombre_municipio == "Sucre"
        assert sucre.total_mesas_municipio == 50
        assert sucre.actas_validadas_municipio == 40
        assert sucre.porcentaje_avance_municipio == 80.0
        # Total válidos = 1000. P1 gana con 400 (40%)
        assert sucre.ganador is not None
        assert sucre.ganador.sigla_candidato == "P1"
        assert sucre.ganador.votos == 400
        assert sucre.ganador.porcentaje == 40.0
        assert len(sucre.resultados_candidatos) == 4
        # Orden de papeleta P1..P4
        siglas = [c.sigla_candidato for c in sucre.resultados_candidatos]
        assert siglas == ["P1", "P2", "P3", "P4"]

        yotala = result.municipios[1]
        assert yotala.actas_validadas_municipio == 0
        assert yotala.porcentaje_avance_municipio == 0.0
        assert yotala.ganador is None  # sin votos → sin ganador

    async def test_depto_inexistente_lanza_excepcion(self) -> None:
        use_case, _ = _build_use_case()
        # No preset departamentos → todos retornan None desde el fake.

        with pytest.raises(DepartamentoNoExisteException) as exc:
            await use_case.execute(99)
        assert "99" in str(exc.value)
        assert "no existe en el catálogo OEP" in str(exc.value)
