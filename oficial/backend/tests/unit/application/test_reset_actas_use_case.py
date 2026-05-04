"""Test del ResetActasUseCase con fakes."""

from datetime import datetime

from recuento_oficial.application.use_cases.reset_actas_use_case import (
    ResetActasUseCase,
)
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.repositories.inconsistencia_repository import (
    Inconsistencia,
)
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository
from tests.unit.fakes.fake_actas_descartadas_repository import (
    FakeActasDescartadasRepository,
)
from tests.unit.fakes.fake_inconsistencia_repository import (
    FakeInconsistenciaRepository,
)


class TestResetActasUseCase:
    async def test_happy_path_devuelve_conteos_y_trunca(self) -> None:
        # Setup: BD con 2 actas, 3 inconsistencias y 5 descartadas.
        actas = FakeActaOficialRepository()
        await actas.save(
            ActaOficial(
                codigo_acta=1010200001001,
                codigo_mesa=1010200001001,
                votos_p1=140, votos_p2=39, votos_p3=124, votos_p4=345,
                blancos=76, nulos=64,
                habilitados=877, anfora=788, no_usadas=89,
            )
        )
        await actas.save(
            ActaOficial(
                codigo_acta=1010200001002,
                codigo_mesa=1010200001002,
                votos_p1=28, votos_p2=158, votos_p3=155, votos_p4=347,
                blancos=71, nulos=50,
                habilitados=949, anfora=809, no_usadas=140,
            )
        )

        incons = FakeInconsistenciaRepository()
        for i in range(3):
            await incons.save(
                Inconsistencia(
                    codigo_acta=str(1010200001100 + i),
                    codigo_mesa=1010200001100 + i,
                    tipo="ERROR1",
                    mensaje="test",
                    valores_recibidos={},
                    timestamp=datetime.now(),
                )
            )

        descartadas = FakeActasDescartadasRepository(initial_count=5)

        use_case = ResetActasUseCase(actas, incons, descartadas)

        report = await use_case.execute()

        assert report.rows_truncated == {
            "acta_oficial": 2,
            "log_inconsistencias": 3,
            "actas_descartadas": 5,
        }
        # Después del reset todo está vacío
        assert await actas.count_all() == 0
        assert await incons.count_all() == 0
        assert await descartadas.count_all() == 0

    async def test_bd_vacia_devuelve_ceros(self) -> None:
        use_case = ResetActasUseCase(
            FakeActaOficialRepository(),
            FakeInconsistenciaRepository(),
            FakeActasDescartadasRepository(),
        )

        report = await use_case.execute()

        assert report.rows_truncated == {
            "acta_oficial": 0,
            "log_inconsistencias": 0,
            "actas_descartadas": 0,
        }
