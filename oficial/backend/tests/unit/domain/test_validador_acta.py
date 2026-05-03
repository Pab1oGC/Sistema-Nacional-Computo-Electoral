"""Tests del ValidadorActa: Error1 y Error2 con mensajes literales del enunciado.

Acta ground truth: 1010200001001 (valores reales del Excel del docente).
- habilitados = 877
- anfora = 788
- no_usadas = 89
  Verificación Error1: 877 = 788 + 89 ✓
- votos_p1=140, votos_p2=39, votos_p3=124, votos_p4=345 → suma = 648
- blancos = 76
- nulos = 64
  Verificación Error2: 648 + 76 + 64 = 788 = anfora ✓
"""

from datetime import datetime, timezone

import pytest

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.exceptions import ErroresDeValidacionException
from recuento_oficial.domain.services.validador_acta import ValidadorActa


def _build_acta(**overrides: int) -> ActaOficial:
    defaults: dict[str, int | str | datetime] = {
        "id_acta": "sha256:test",
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
        "fecha_creacion": datetime(2026, 5, 3, tzinfo=timezone.utc),
    }
    defaults.update(overrides)
    return ActaOficial(**defaults)  # type: ignore[arg-type]


class TestValidadorActa:
    def test_acta_consistente_no_lanza(self) -> None:
        # 877 = 788 + 89 (Error1 OK)
        # 648 + 76 + 64 = 788 = anfora (Error2 OK)
        acta = _build_acta()
        ValidadorActa().validar(acta)

    def test_error1_falta_papeleta(self) -> None:
        # no_usadas=88 → 788+88=876, 877-876=+1 (solo Error1 fires; Error2 OK)
        acta = _build_acta(no_usadas=88)
        with pytest.raises(ErroresDeValidacionException) as exc:
            ValidadorActa().validar(acta)
        mensaje = exc.value.errores[0]
        assert "Son 877 ciudadanos" in mensaje
        assert "hay 788 papeletas en el ánfora" in mensaje
        assert "88 papeletas no usadas" in mensaje
        assert "diferencia de +1 papeletas" in mensaje

    def test_error1_sobra_papeleta(self) -> None:
        # no_usadas=90 → 788+90=878, 877-878=-1 (solo Error1 fires; Error2 OK)
        acta = _build_acta(no_usadas=90)
        with pytest.raises(ErroresDeValidacionException) as exc:
            ValidadorActa().validar(acta)
        mensaje = exc.value.errores[0]
        assert "diferencia de -1 papeletas" in mensaje

    def test_error2_votos_no_cuadran(self) -> None:
        # 140+39+124+345 = 648 votos por partidos
        # Default consistente: 648 + 76 + 64 = 788 = anfora
        # Modificamos blancos a 75 para romper:
        #   648 + 75 + 64 = 787 ≠ 788  →  Error2 con diff=-1
        # Error1 sigue OK (no tocamos habilitados/anfora/no_usadas)
        acta = _build_acta(blancos=75)
        with pytest.raises(ErroresDeValidacionException) as exc:
            ValidadorActa().validar(acta)
        mensajes = exc.value.errores
        assert len(mensajes) == 1
        assert "Son 648 votos por partidos" in mensajes[0]
        assert "75 votos blancos" in mensajes[0]
        assert "64 votos nulos" in mensajes[0]
        assert "no inciden con la cantidad de boletas en el ánfora -1" in mensajes[0]

    def test_error1_y_error2_simultaneos(self) -> None:
        # Romper ambos balances:
        #   anfora=800 → 877-(800+89) = -12  (Error1 dispara con diff=-12)
        #   648+76+64=788 ≠ 800             (Error2 dispara con diff=-12)
        acta = _build_acta(anfora=800)
        with pytest.raises(ErroresDeValidacionException) as exc:
            ValidadorActa().validar(acta)
        mensajes = exc.value.errores
        assert len(mensajes) == 2
        assert any("papeletas no usadas" in m for m in mensajes)
        assert any("votos por partidos" in m for m in mensajes)
        assert any("diferencia de -12 papeletas" in m for m in mensajes)
        assert any("ánfora -12" in m for m in mensajes)

    def test_mensaje_error1_es_literal_del_enunciado(self) -> None:
        acta = _build_acta(no_usadas=88)
        with pytest.raises(ErroresDeValidacionException) as exc:
            ValidadorActa().validar(acta)
        msg = exc.value.errores[0]
        # Frase literal del enunciado
        assert msg.startswith("Son ")
        assert " ciudadanos, hay " in msg
        assert " papeletas en el ánfora y " in msg
        assert " papeletas no usadas, hay una diferencia de " in msg
        assert msg.endswith(" papeletas")
