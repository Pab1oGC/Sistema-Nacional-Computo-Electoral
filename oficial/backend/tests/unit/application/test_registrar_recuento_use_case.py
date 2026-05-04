"""Tests del use case RegistrarRecuentoUseCase con fakes.

Cubre Error3 (mesa no existe), Error4 (idempotencia), happy path,
persistencia de inconsistencias Error1/2 y Error3.
"""

import pytest

from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)
from recuento_oficial.application.use_cases.registrar_recuento_use_case import (
    RegistrarRecuentoUseCase,
)
from recuento_oficial.domain.exceptions import (
    ActaNoExisteException,
    ActaYaProcesadaException,
    ErroresDeValidacionException,
    InconsistenciaNumericaException,
)
from recuento_oficial.domain.services.validador_acta import ValidadorActa
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository
from tests.unit.fakes.fake_inconsistencia_repository import (
    FakeInconsistenciaRepository,
)
from tests.unit.fakes.fake_mesa_repository import FakeMesaRepository


def _build_dto(**overrides) -> RegistrarRecuentoDTO:
    """Defaults = acta real 1010200001001 del Excel del docente.

    Sumas: 140+39+124+345 = 648 votos por partidos.
    Verificación Error1: 877 = 788 + 89 ✓
    Verificación Error2: 648 + 76 + 64 = 788 = anfora ✓
    """
    defaults = {
        "codigo_acta": 1010200001001,
        "codigo_mesa": 1010200001001,
        "votos_p1": 140,
        "votos_p2": 39,
        "votos_p3": 124,
        "votos_p4": 345,
        "blancos": 76,
        "nulos": 64,
        "habilitados": 877,
        "anfora": 788,
        "no_usadas": 89,
    }
    defaults.update(overrides)
    return RegistrarRecuentoDTO(**defaults)


def _build_use_case() -> tuple[
    RegistrarRecuentoUseCase,
    FakeActaOficialRepository,
    FakeInconsistenciaRepository,
    FakeMesaRepository,
]:
    acta_repo = FakeActaOficialRepository()
    inc_repo = FakeInconsistenciaRepository()
    mesa_repo = FakeMesaRepository()  # default: existe=True para todas
    use_case = RegistrarRecuentoUseCase(
        acta_repo, mesa_repo, inc_repo, ValidadorActa()
    )
    return use_case, acta_repo, inc_repo, mesa_repo


class TestRegistrarRecuentoUseCase:
    async def test_happy_path_persiste_acta(self) -> None:
        use_case, acta_repo, inc_repo, _ = _build_use_case()
        dto = _build_dto()

        acta = await use_case.execute(dto)

        assert acta.codigo_acta == 1010200001001
        assert await acta_repo.exists_by_codigo(dto.codigo_acta)
        assert await inc_repo.count() == 0

    async def test_error4_acta_ya_procesada(self) -> None:
        use_case, _, _, _ = _build_use_case()
        dto = _build_dto()

        await use_case.execute(dto)

        with pytest.raises(ActaYaProcesadaException) as exc:
            await use_case.execute(dto)
        assert "1010200001001" in str(exc.value)
        assert "ya ha sido procesada en la BDD TREP/OFICIAL" in str(exc.value)

    async def test_error1_persiste_inconsistencia_y_no_guarda_acta(self) -> None:
        use_case, acta_repo, inc_repo, _ = _build_use_case()
        # Romper SOLO Error1: cambiar no_usadas en lugar de anfora.
        # no_usadas=88 → 788+88=876, 877-876=+1 (Error1 dispara, Error2 sigue OK)
        dto = _build_dto(no_usadas=88)

        with pytest.raises(ErroresDeValidacionException):
            await use_case.execute(dto)

        assert not await acta_repo.exists_by_codigo(dto.codigo_acta)
        assert await inc_repo.count() == 1
        assert await inc_repo.count(tipo="ERROR1") == 1

    async def test_tipo_mas_comun_en_inconsistencias(self) -> None:
        use_case, _, inc_repo, _ = _build_use_case()

        # 2 actas con SOLO Error1 (no_usadas=88 rompe únicamente la ecuación de Error1)
        for codigo in [1010200001001, 1010200001002]:
            dto = _build_dto(codigo_acta=codigo, no_usadas=88)
            with pytest.raises(ErroresDeValidacionException):
                await use_case.execute(dto)

        assert await inc_repo.tipo_mas_comun() == "ERROR1"

    async def test_error3_acta_con_mesa_inexistente(self) -> None:
        # Setup: TODA mesa NO existe en el catálogo.
        use_case, acta_repo, inc_repo, mesa_repo = _build_use_case()
        mesa_repo.set_existe(False)
        dto = _build_dto()

        with pytest.raises(ActaNoExisteException) as exc:
            await use_case.execute(dto)

        # Mensaje literal del enunciado del docente
        assert "1010200001001" in str(exc.value)
        assert "no se encuentra en la BDD TREP/OFICIAL" in str(exc.value)
        # No se persiste el acta (mesa no existe → FK violation evitada)
        assert not await acta_repo.exists_by_codigo(dto.codigo_acta)
        # Sí se persiste el log de inconsistencia con tipo ERROR3
        assert await inc_repo.count() == 1
        assert await inc_repo.count(tipo="ERROR3") == 1

    async def test_error3_invoca_commit_pendiente(self) -> None:
        # Verifica que el use case llama al commit explícito ANTES del raise.
        # Sin esto, el INSERT al log_inconsistencias se perdería con el
        # rollback automático que FastAPI hace al manejar la excepción.
        use_case, _, inc_repo, mesa_repo = _build_use_case()
        mesa_repo.set_existe(False)
        dto = _build_dto()

        with pytest.raises(ActaNoExisteException):
            await use_case.execute(dto)

        assert inc_repo.get_commits_count() == 1

    async def test_error1_invoca_commit_pendiente(self) -> None:
        # Mismo principio: si Error1/2 disparan, el log debe sobrevivir
        # al rollback de FastAPI vía commit explícito.
        use_case, _, inc_repo, _ = _build_use_case()
        dto = _build_dto(no_usadas=88)

        with pytest.raises(ErroresDeValidacionException):
            await use_case.execute(dto)

        assert inc_repo.get_commits_count() == 1

    async def test_votos_negativos_lanza_inconsistencia_numerica(self) -> None:
        # Pydantic deja pasar valores negativos (la regla es de negocio).
        # El use case detecta y persiste como INCONSISTENCIA_NUMERICA.
        use_case, acta_repo, inc_repo, _ = _build_use_case()
        dto = _build_dto(votos_p4=-5, votos_p2=-1)

        with pytest.raises(InconsistenciaNumericaException) as exc:
            await use_case.execute(dto)

        # Mensaje informativo con campos y valores
        assert "votos_p4=-5" in str(exc.value)
        assert "votos_p2=-1" in str(exc.value)

        # NO se persistió el acta (FK válido pero valores imposibles)
        assert not await acta_repo.exists_by_codigo(dto.codigo_acta)
        # SÍ se persistió un audit log con tipo INCONSISTENCIA_NUMERICA
        assert await inc_repo.count(tipo="INCONSISTENCIA_NUMERICA") == 1
        # Y se invocó commit explícito antes del raise
        assert inc_repo.get_commits_count() == 1

    async def test_acta_normal_sigue_funcionando(self) -> None:
        # Smoke: confirmar que el cambio no rompe el happy path.
        use_case, _, _, _ = _build_use_case()
        dto = _build_dto()
        acta = await use_case.execute(dto)
        assert acta.codigo_acta == 1010200001001
