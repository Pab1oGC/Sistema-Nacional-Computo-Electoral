"""Tests del use case RegistrarRecuentoUseCase con fakes.

Cubre Error4 (idempotencia), happy path, persistencia de inconsistencias.
"""

import pytest

from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)
from recuento_oficial.application.use_cases.registrar_recuento_use_case import (
    RegistrarRecuentoUseCase,
)
from recuento_oficial.domain.exceptions import (
    ActaYaProcesadaException,
    ErroresDeValidacionException,
)
from recuento_oficial.domain.services.validador_acta import ValidadorActa
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository
from tests.unit.fakes.fake_inconsistencia_repository import (
    FakeInconsistenciaRepository,
)


def _build_dto(**overrides: int | str) -> RegistrarRecuentoDTO:
    """Defaults = acta real 1010200001001 del Excel del docente.

    Sumas: 140+39+124+345 = 648 votos por partidos.
    Verificación Error1: 877 = 788 + 89 ✓
    Verificación Error2: 648 + 76 + 64 = 788 = anfora ✓
    """
    defaults: dict[str, int | str] = {
        "codigo_acta": "1010200001001",
        "codigo_mesa": 35000,
        "votos_p1": 140,
        "votos_p2": 39,
        "votos_p3": 124,
        "votos_p4": 345,
        "blancos": 76,
        "nulos": 64,
        "habilitados": 877,
        "anfora": 788,
        "no_usadas": 89,
        "apertura_hora": 8,
        "apertura_minutos": 1,
        "cierre_hora": 16,
        "cierre_minutos": 4,
    }
    defaults.update(overrides)
    return RegistrarRecuentoDTO(**defaults)  # type: ignore[arg-type]


def _build_use_case() -> tuple[
    RegistrarRecuentoUseCase, FakeActaOficialRepository, FakeInconsistenciaRepository
]:
    acta_repo = FakeActaOficialRepository()
    inc_repo = FakeInconsistenciaRepository()
    use_case = RegistrarRecuentoUseCase(acta_repo, inc_repo, ValidadorActa())
    return use_case, acta_repo, inc_repo


class TestRegistrarRecuentoUseCase:
    async def test_happy_path_persiste_acta(self) -> None:
        use_case, acta_repo, inc_repo = _build_use_case()
        dto = _build_dto()

        acta = await use_case.execute(dto)

        assert acta.codigo_acta == "1010200001001"
        assert await acta_repo.exists(dto.id_acta)
        assert await inc_repo.count() == 0

    async def test_error4_acta_ya_procesada(self) -> None:
        use_case, _, _ = _build_use_case()
        dto = _build_dto()

        await use_case.execute(dto)

        with pytest.raises(ActaYaProcesadaException) as exc:
            await use_case.execute(dto)
        assert "1010200001001" in str(exc.value)
        assert "ya ha sido procesada en la BDD TREP/OFICIAL" in str(exc.value)

    async def test_error1_persiste_inconsistencia_y_no_guarda_acta(self) -> None:
        use_case, acta_repo, inc_repo = _build_use_case()
        # Romper SOLO Error1: cambiar no_usadas en lugar de anfora.
        # no_usadas=88 → 788+88=876, 877-876=+1 (Error1 dispara, Error2 sigue OK)
        dto = _build_dto(no_usadas=88)

        with pytest.raises(ErroresDeValidacionException):
            await use_case.execute(dto)

        assert not await acta_repo.exists(dto.id_acta)
        assert await inc_repo.count() == 1
        assert await inc_repo.count(tipo="ERROR1") == 1

    async def test_tipo_mas_comun_en_inconsistencias(self) -> None:
        use_case, _, inc_repo = _build_use_case()

        # 2 actas con SOLO Error1 (no_usadas=88 rompe únicamente la ecuación de Error1)
        for codigo in ["1010200001001", "1010200001002"]:
            dto = _build_dto(codigo_acta=codigo, no_usadas=88)
            with pytest.raises(ErroresDeValidacionException):
                await use_case.execute(dto)

        assert await inc_repo.tipo_mas_comun() == "ERROR1"
