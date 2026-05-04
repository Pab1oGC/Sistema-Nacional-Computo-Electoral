"""Tests del use case ConsultarResultadosPorDepartamentoUseCase con fakes.

El fake del repository preset los agregados crudos (lo que devolvería la
SQL real); el test verifica que el use case compone correctamente con el
catálogo de partidos y deriva ganador + porcentajes.
"""

from recuento_oficial.application.use_cases.consultar_resultados_por_departamento_use_case import (
    ConsultarResultadosPorDepartamentoUseCase,
)
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ResultadoDepto,
)
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository
from tests.unit.fakes.fake_partido_repository import FakePartidoRepository


def _build_use_case() -> tuple[
    ConsultarResultadosPorDepartamentoUseCase,
    FakeActaOficialRepository,
]:
    acta_repo = FakeActaOficialRepository()
    partido_repo = FakePartidoRepository()  # default seed con los 4 partidos
    use_case = ConsultarResultadosPorDepartamentoUseCase(acta_repo, partido_repo)
    return use_case, acta_repo


class TestConsultarResultadosPorDepartamentoUseCase:
    async def test_happy_path_compone_ganador_y_porcentajes(self) -> None:
        use_case, acta_repo = _build_use_case()
        acta_repo.set_depto_aggregates(
            [
                ResultadoDepto(
                    id_departamento=1,
                    nombre_departamento="Chuquisaca",
                    total_mesas_depto=100,
                    actas_validadas_depto=80,
                    votos_p1=1000,  # ganador
                    votos_p2=500,
                    votos_p3=300,
                    votos_p4=200,
                ),
            ]
        )

        result = await use_case.execute()

        assert len(result.departamentos) == 1
        chuq = result.departamentos[0]
        assert chuq.id_departamento == 1
        assert chuq.nombre_departamento == "Chuquisaca"
        assert chuq.total_mesas_depto == 100
        assert chuq.actas_validadas_depto == 80
        assert chuq.porcentaje_avance_depto == 80.0
        # Total válidos = 1000+500+300+200 = 2000. P1 gana con 1000 (50.0%)
        assert chuq.ganador is not None
        assert chuq.ganador.sigla_candidato == "P1"
        assert chuq.ganador.nombre_candidato == "Daenerys Targaryen"
        assert chuq.ganador.sigla_partido == "MAS-ISP"
        assert chuq.ganador.color_hex == "#003087"
        assert chuq.ganador.votos == 1000
        assert chuq.ganador.porcentaje == 50.0
        # 4 candidatos en orden de papeleta (P1..P4)
        siglas = [c.sigla_candidato for c in chuq.resultados_candidatos]
        assert siglas == ["P1", "P2", "P3", "P4"]
        # Porcentajes: 1000/2000=50, 500/2000=25, 300/2000=15, 200/2000=10
        porcentajes = [c.porcentaje for c in chuq.resultados_candidatos]
        assert porcentajes == [50.0, 25.0, 15.0, 10.0]

    async def test_departamento_sin_actas_devuelve_ganador_none(self) -> None:
        use_case, acta_repo = _build_use_case()
        acta_repo.set_depto_aggregates(
            [
                ResultadoDepto(
                    id_departamento=2,
                    nombre_departamento="La Paz",
                    total_mesas_depto=200,
                    actas_validadas_depto=0,
                    votos_p1=0,
                    votos_p2=0,
                    votos_p3=0,
                    votos_p4=0,
                ),
            ]
        )

        result = await use_case.execute()

        assert len(result.departamentos) == 1
        lapaz = result.departamentos[0]
        assert lapaz.actas_validadas_depto == 0
        assert lapaz.porcentaje_avance_depto == 0.0
        assert lapaz.ganador is None
        # Todos los candidatos siguen apareciendo, con 0 votos y 0%
        assert len(lapaz.resultados_candidatos) == 4
        for c in lapaz.resultados_candidatos:
            assert c.votos == 0
            assert c.porcentaje == 0.0
