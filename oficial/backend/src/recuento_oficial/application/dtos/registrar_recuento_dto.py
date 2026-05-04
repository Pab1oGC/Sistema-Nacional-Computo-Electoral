from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RegistrarRecuentoDTO:
    """DTO de entrada al RegistrarRecuentoUseCase.

    Schema v2: codigo_acta es BIGINT en BD; el DTO lo expone como int. La
    idempotencia (Error4) se basa en la UNIQUE constraint de codigo_acta,
    no en un id_acta lógico generado por el use case.

    observacion_formal y tipo_observacion_formal son opcionales: la mayoría
    de actas no traen observación formal del docente.
    """

    codigo_acta: int
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
    observacion_formal: str | None = None
    tipo_observacion_formal: str | None = None
