import re
from dataclasses import dataclass

CODIGO_ACTA_LENGTH = 13
_CODIGO_ACTA_RE = re.compile(rf"^\d{{{CODIGO_ACTA_LENGTH}}}$")


@dataclass(frozen=True)
class CodigoActa:
    """Código de acta de exactamente 13 dígitos numéricos."""

    valor: str

    def __post_init__(self) -> None:
        if not _CODIGO_ACTA_RE.match(self.valor):
            raise ValueError(
                f"codigo_acta debe ser una cadena de exactamente "
                f"{CODIGO_ACTA_LENGTH} dígitos numéricos, recibido: {self.valor!r}"
            )

    def __str__(self) -> str:
        return self.valor
