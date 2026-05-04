"""Excepciones de dominio del módulo Cómputo Oficial.

Mensajes literales del enunciado del docente para Error1 a Error4.
NO parafrasear: el evaluador busca las cadenas exactas.
"""


class DominioException(Exception):
    """Base de todas las excepciones de dominio."""


class ActaYaProcesadaException(DominioException):
    """Error4: el acta ya fue procesada (idempotencia)."""

    def __init__(self, codigo_acta: str) -> None:
        self.codigo_acta = codigo_acta
        super().__init__(
            f"El acta {codigo_acta} ya ha sido procesada en la BDD TREP/OFICIAL"
        )


class ActaNoExisteException(DominioException):
    """Error3: el acta no existe en la BDD."""

    def __init__(self, codigo_acta: str) -> None:
        self.codigo_acta = codigo_acta
        super().__init__(
            f"El acta {codigo_acta} no se encuentra en la BDD TREP/OFICIAL"
        )


class ErroresDeValidacionException(DominioException):
    """Error1 + Error2: lista de errores aritméticos del acta."""

    def __init__(self, errores: list[str]) -> None:
        self.errores = list(errores)
        super().__init__("; ".join(self.errores))


class ReplicaNoDisponibleException(DominioException):
    """La réplica de PostgreSQL no está disponible."""


class DepartamentoNoExisteException(DominioException):
    """El código de departamento solicitado no existe en el catálogo."""

    def __init__(self, codigo: int) -> None:
        self.codigo = codigo
        super().__init__(
            f"El departamento con código {codigo} no existe en el catálogo OEP"
        )
