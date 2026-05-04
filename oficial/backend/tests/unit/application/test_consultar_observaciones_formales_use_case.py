"""Tests del use case ConsultarObservacionesFormalesUseCase."""

from recuento_oficial.application.use_cases.consultar_observaciones_formales_use_case import (
    ConsultarObservacionesFormalesUseCase,
    DESCRIPCION_HUMANA,
    ORDEN_TIPOS,
)
from tests.unit.fakes.fake_acta_oficial_repository import FakeActaOficialRepository


def _build_use_case() -> tuple[
    ConsultarObservacionesFormalesUseCase, FakeActaOficialRepository
]:
    repo = FakeActaOficialRepository()
    use_case = ConsultarObservacionesFormalesUseCase(repo)
    return use_case, repo


class TestConsultarObservacionesFormales:
    async def test_happy_path_3_categorias_con_actas_resto_en_cero(self) -> None:
        use_case, repo = _build_use_case()
        repo.set_observaciones_count(
            {
                "ERRORES_TRANSCRIPCION": 3,
                "FECHA_INCORRECTA": 1,
                "FALTA_FIRMAS_HUELLAS": 1,
            }
        )

        report = await use_case.execute()

        # Total de las 3 categorías con observaciones
        assert report.total == 5

        # Las 9 categorías SIEMPRE están presentes
        assert len(report.conteos_por_tipo) == 9
        assert [c.tipo for c in report.conteos_por_tipo] == list(ORDEN_TIPOS)

        # Cantidades correctas
        por_tipo = {c.tipo: c for c in report.conteos_por_tipo}
        assert por_tipo["ERRORES_TRANSCRIPCION"].cantidad == 3
        assert por_tipo["FECHA_INCORRECTA"].cantidad == 1
        assert por_tipo["FALTA_FIRMAS_HUELLAS"].cantidad == 1

        # Las 6 sin actas vienen en 0
        sin_actas = [
            "FALTA_DATOS_APERTURA_CIERRE",
            "MESA_LUGAR_DISTINTO",
            "USO_FORMULARIOS_NO_OFICIALES",
            "PAPELETAS_NO_AUTORIZADAS",
            "AUSENCIA_DELEGADOS",
            "INCONSISTENCIA_ARITMETICA",
        ]
        for tipo in sin_actas:
            assert por_tipo[tipo].cantidad == 0

        # Cada item lleva descripción humana
        for c in report.conteos_por_tipo:
            assert c.descripcion_humana == DESCRIPCION_HUMANA[c.tipo]
            assert len(c.descripcion_humana) > 10  # texto, no string vacío

    async def test_empty_devuelve_9_categorias_en_cero(self) -> None:
        use_case, _ = _build_use_case()
        # No preset → todos los conteos son 0

        report = await use_case.execute()

        assert report.total == 0
        assert len(report.conteos_por_tipo) == 9
        for c in report.conteos_por_tipo:
            assert c.cantidad == 0
            # Las descripciones humanas siguen presentes para que el dashboard
            # pueda renderizar las 9 barras vacías con sus labels.
            assert c.descripcion_humana
