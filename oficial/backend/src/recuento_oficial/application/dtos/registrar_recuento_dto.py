import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class RegistrarRecuentoDTO:
    codigo_acta: str
    codigo_mesa: int
    votos_p1: int
    votos_p2: int
    votos_p3: int
    votos_p4: int
    blancos: int
    nulos: int
    habilitados: int
    anfora: int
    no_usadas: int
    apertura_hora: int | None = None
    apertura_minutos: int | None = None
    cierre_hora: int | None = None
    cierre_minutos: int | None = None

    @property
    def id_acta(self) -> str:
        """Hash determinista usado como llave de idempotencia (Error4).

        Cualquier cambio en el contenido del acta produce un id_acta distinto,
        incluyendo los horarios de apertura y cierre. Re-enviar con los MISMOS
        valores es idempotente (Error4 dispara); enviar con valores corregidos
        genera un id_acta nuevo y se procesa como acta distinta.
        """
        canonico = (
            f"{self.codigo_acta}|{self.codigo_mesa}|"
            f"P:{self.votos_p1},{self.votos_p2},{self.votos_p3},{self.votos_p4}|"
            f"B:{self.blancos},N:{self.nulos}|"
            f"H:{self.habilitados},A:{self.anfora},NU:{self.no_usadas}|"
            f"T:{self.apertura_hora}:{self.apertura_minutos}"
            f"-{self.cierre_hora}:{self.cierre_minutos}"
        )
        return "sha256:" + hashlib.sha256(canonico.encode()).hexdigest()
