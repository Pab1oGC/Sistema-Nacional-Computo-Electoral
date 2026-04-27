from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from pymongo.database import Database


@dataclass
class ValidationResult:
    ok: bool
    errores: list[str] = field(default_factory=list)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def validate(acta: dict, db: Database) -> ValidationResult:
    errores: list[str] = []

    _check_aritmetica(acta, errores)
    _check_datos_contradictorios(acta, db, errores)
    _check_horarios(acta, errores)
    _check_duplicado(acta, db, errores)

    return ValidationResult(ok=len(errores) == 0, errores=errores)


def _check_aritmetica(acta: dict, errores: list[str]) -> None:
    """Regla 1: suma(votos candidatos) debe ser igual a votos_validos."""
    votos = acta.get("votos", {})
    if not votos:
        return

    suma = sum(votos.values())
    validos = acta.get("votos_validos")
    if validos is None:
        return

    if suma != validos:
        errores.append(
            f"INCONSISTENCIA_ARITMETICA: suma votos={suma} ≠ votos_validos={validos}"
        )


def _check_datos_contradictorios(acta: dict, db: Database, errores: list[str]) -> None:
    """Regla 2: ciudadanos_habilitados en acta debe coincidir con el registro de la mesa."""
    habilitados_acta: Optional[int] = acta.get("ciudadanos_habilitados")
    if habilitados_acta is None:
        return

    mesa = db.mesas.find_one(
        {"codigo_mesa": acta["codigo_mesa"]},
        {"cantidad_habilitada": 1},
    )
    if mesa is None:
        return

    habilitados_mesa: Optional[int] = mesa.get("cantidad_habilitada")
    if habilitados_mesa is None:
        return

    if habilitados_acta != habilitados_mesa:
        errores.append(
            f"DATOS_CONTRADICTORIOS: ciudadanos_habilitados={habilitados_acta} "
            f"≠ cantidad_habilitada en mesa={habilitados_mesa}"
        )


def _check_horarios(acta: dict, errores: list[str]) -> None:
    """Regla 3: hora_apertura y hora_cierre deben estar presentes."""
    if not acta.get("hora_apertura"):
        errores.append("FALTA_APERTURA_CIERRE: hora_apertura ausente")
    if not acta.get("hora_cierre"):
        errores.append("FALTA_APERTURA_CIERRE: hora_cierre ausente")


def _check_duplicado(acta: dict, db: Database, errores: list[str]) -> None:
    """Regla 4: no debe existir otra acta VALIDADA para la misma mesa con distinto id_acta."""
    duplicado = db.actas.find_one(
        {
            "codigo_mesa": acta["codigo_mesa"],
            "estado": "VALIDADA",
            "id_acta": {"$ne": acta["id_acta"]},
        },
        {"id_acta": 1},
    )
    if duplicado:
        errores.append(
            f"DUPLICADO: ya existe acta VALIDADA {duplicado['id_acta']} "
            f"para la mesa {acta['codigo_mesa']}"
        )
