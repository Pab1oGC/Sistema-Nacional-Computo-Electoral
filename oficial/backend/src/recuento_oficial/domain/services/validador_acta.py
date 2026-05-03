"""Validador de Error1 y Error2 sobre una entity ActaOficial.

Mensajes literales del enunciado del docente. NO parafrasear.
Sin acceso a BD: las reglas son aritméticas puras.

Error1: habilitados = anfora + no_usadas
Error2: anfora = (votos_p1+p2+p3+p4) + blancos + nulos
"""

from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.exceptions import ErroresDeValidacionException


class ValidadorActa:
    def validar(self, acta: ActaOficial) -> None:
        """Lanza ErroresDeValidacionException con TODOS los errores detectados.

        Acumular antes de lanzar permite al cliente HTTP recibir todos los
        problemas de un acta en una sola respuesta 422.
        """
        errores: list[str] = []
        self._validar_error1(acta, errores)
        self._validar_error2(acta, errores)
        if errores:
            raise ErroresDeValidacionException(errores)

    @staticmethod
    def _signo(valor: int) -> str:
        return "+" if valor > 0 else "-"

    @staticmethod
    def _validar_error1(a: ActaOficial, errores: list[str]) -> None:
        diferencia = a.habilitados - (a.anfora + a.no_usadas)
        if diferencia != 0:
            signo = ValidadorActa._signo(diferencia)
            errores.append(
                f"Son {a.habilitados} ciudadanos, hay {a.anfora} papeletas "
                f"en el ánfora y {a.no_usadas} papeletas no usadas, "
                f"hay una diferencia de {signo}{abs(diferencia)} papeletas"
            )

    @staticmethod
    def _validar_error2(a: ActaOficial, errores: list[str]) -> None:
        votos_partidos = a.votos_p1 + a.votos_p2 + a.votos_p3 + a.votos_p4
        total_contado = votos_partidos + a.blancos + a.nulos
        diferencia = total_contado - a.anfora
        if diferencia != 0:
            signo = ValidadorActa._signo(diferencia)
            errores.append(
                f"Son {votos_partidos} votos por partidos, "
                f"{a.blancos} votos blancos y {a.nulos} votos nulos no inciden "
                f"con la cantidad de boletas en el ánfora "
                f"{signo}{abs(diferencia)}"
            )
