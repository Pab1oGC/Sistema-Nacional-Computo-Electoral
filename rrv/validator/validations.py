"""
Validador RRV — Recuento Rápido de Votos
========================================
Base normativa:
  - Reglamento Elecciones Generales 2025, Art. 49
  - Ley N° 026, Art. 177  (el RRV NO declara nulidad legal; solo genera alerta)

Estados posibles: COMPUTABLE_RRV | NO_COMPUTABLE_RRV
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional
from pymongo.database import Database

# ── Umbrales ──────────────────────────────────────────────────────────────────
OCR_CONFIDENCE_MIN = 0.90   # campos numéricos obligatorios
IMAGE_QUALITY_MIN  = 0.75

ESTADO_COMPUTABLE    = "COMPUTABLE_RRV"
ESTADO_NO_COMPUTABLE = "NO_COMPUTABLE_RRV"


# ── Estructuras de resultado ──────────────────────────────────────────────────

@dataclass
class Validaciones:
    suma_candidatos:               bool = False
    suma_emitidos:                 bool = False
    votos_no_superan_habilitados:  bool = False
    campos_obligatorios_completos: bool = False
    duplicado_conflictivo:         bool = False

    def to_dict(self) -> dict:
        return {
            "suma_candidatos":               self.suma_candidatos,
            "suma_emitidos":                 self.suma_emitidos,
            "votos_no_superan_habilitados":  self.votos_no_superan_habilitados,
            "campos_obligatorios_completos": self.campos_obligatorios_completos,
            "duplicado_conflictivo":         self.duplicado_conflictivo,
        }


@dataclass
class ValidationResultRRV:
    acta_id:      str
    estado_rrv:   str
    publicar_rrv: bool
    motivo_rrv:   str
    errores:      list[str]        = field(default_factory=list)
    advertencias: list[str]        = field(default_factory=list)
    observacion_detectada:                  bool = False
    observacion_fuera_recuadro:             bool = False
    observacion_afecta_campos_obligatorios: bool = False
    posible_nulidad_legal: bool = False
    alerta_legal:          bool = False
    validaciones: Validaciones = field(default_factory=Validaciones)

    @property
    def ok(self) -> bool:
        return self.estado_rrv == ESTADO_COMPUTABLE

    def to_dict(self) -> dict:
        return {
            "acta_id":      self.acta_id,
            "estado_rrv":   self.estado_rrv,
            "publicar_rrv": self.publicar_rrv,
            "motivo_rrv":   self.motivo_rrv,
            "errores":      self.errores,
            "advertencias": self.advertencias,
            "observacion_detectada":                  self.observacion_detectada,
            "observacion_fuera_recuadro":             self.observacion_fuera_recuadro,
            "observacion_afecta_campos_obligatorios": self.observacion_afecta_campos_obligatorios,
            "posible_nulidad_legal": self.posible_nulidad_legal,
            "alerta_legal":          self.alerta_legal,
            "validaciones":          self.validaciones.to_dict(),
        }


# ── Helper para construir NO_COMPUTABLE_RRV ───────────────────────────────────

def _no_computable(
    acta_id: str,
    motivo: str,
    errores: Optional[list[str]] = None,
    advertencias: Optional[list[str]] = None,
    posible_nulidad: bool = False,
    validaciones: Optional[Validaciones] = None,
    **flags,
) -> ValidationResultRRV:
    r = ValidationResultRRV(
        acta_id=acta_id,
        estado_rrv=ESTADO_NO_COMPUTABLE,
        publicar_rrv=False,
        motivo_rrv=motivo,
        errores=errores or [motivo],
        advertencias=advertencias or [],
        posible_nulidad_legal=posible_nulidad,
        alerta_legal=posible_nulidad or flags.get("alerta_legal", False),
        validaciones=validaciones or Validaciones(),
    )
    for k, v in flags.items():
        if hasattr(r, k):
            setattr(r, k, v)
    return r


# ── Función principal de validación ───────────────────────────────────────────

def validate(acta: dict, db: Database) -> ValidationResultRRV:
    """
    Valida un acta extraída por OCR aplicando las reglas del RRV.
    Retorna ValidationResultRRV con estado COMPUTABLE_RRV o NO_COMPUTABLE_RRV.
    El RRV nunca declara nulidad legal — solo activa posible_nulidad_legal=true
    como alerta para la etapa de Cómputo Oficial.
    """
    id_acta      = acta.get("id_acta", "")
    codigo_mesa  = acta.get("codigo_mesa")
    codigo_recinto = acta.get("codigo_recinto")
    confianza_ocr  = float(acta.get("confianza_ocr") or 0.0)

    val          = Validaciones()
    advertencias: list[str] = []

    # ── A. Detección de observaciones (flags del OCR / análisis de imagen) ──
    obs_detectada = bool(acta.get("observacion_detectada", False))
    obs_fuera     = bool(acta.get("observacion_fuera_recuadro", False))
    obs_afecta    = bool(acta.get("observacion_afecta_campos_obligatorios", False))

    if obs_detectada:
        advertencias.append("Observación detectada en el acta")
    if obs_fuera:
        advertencias.append("Observación fuera del recuadro (Art. 177, Ley N° 026)")

    # Caso: observación invade campos obligatorios → NO_COMPUTABLE
    if obs_afecta:
        return ValidationResultRRV(
            acta_id=id_acta,
            estado_rrv=ESTADO_NO_COMPUTABLE,
            publicar_rrv=False,
            motivo_rrv="Observación invade campos obligatorios",
            errores=["OBSERVACION_INVADE_CAMPOS: la observación tapa un campo obligatorio"],
            advertencias=advertencias,
            observacion_detectada=obs_detectada,
            observacion_fuera_recuadro=obs_fuera,
            observacion_afecta_campos_obligatorios=True,
            posible_nulidad_legal=True,
            alerta_legal=True,
            validaciones=val,
        )

    # ── B. Campos obligatorios presentes ────────────────────────────────────
    votos_obj  = acta.get("votos") or {}
    candidatos = votos_obj.get("candidatos") or []
    validos    = votos_obj.get("validos")
    blancos    = votos_obj.get("blancos")
    nulos      = votos_obj.get("nulos")

    faltantes = []
    if not codigo_mesa:
        faltantes.append("codigo_mesa")
    if not candidatos:
        faltantes.append("votos_por_candidato")
    if validos is None:
        faltantes.append("votos_validos")
    if blancos is None:
        faltantes.append("votos_blancos")
    if nulos is None:
        faltantes.append("votos_nulos")

    val.campos_obligatorios_completos = len(faltantes) == 0

    if faltantes:
        return _no_computable(
            id_acta,
            f"Campos obligatorios incompletos o ilegibles: {', '.join(faltantes)}",
            errores=[f"CAMPO_FALTANTE: {f}" for f in faltantes],
            advertencias=advertencias,
            validaciones=val,
            observacion_detectada=obs_detectada,
            observacion_fuera_recuadro=obs_fuera,
            alerta_legal=obs_fuera,
        )

    # ── C. Confianza OCR insuficiente en campos obligatorios ────────────────
    if confianza_ocr < OCR_CONFIDENCE_MIN and acta.get("requiere_revision", False):
        return _no_computable(
            id_acta,
            f"OCR no confiable en campos obligatorios (confianza={confianza_ocr:.2f}, mín={OCR_CONFIDENCE_MIN})",
            errores=[f"OCR_CONFIANZA_BAJA: {confianza_ocr:.2f} < {OCR_CONFIDENCE_MIN}"],
            advertencias=advertencias,
            validaciones=val,
            observacion_detectada=obs_detectada,
            observacion_fuera_recuadro=obs_fuera,
        )

    # ── D. Habilitados desde catálogo (fuente autoritativa) ─────────────────
    habilitados: Optional[int] = None
    if codigo_recinto and codigo_mesa:
        mesa_doc = db.mesas_actas.find_one(
            {"codigo_recinto": int(codigo_recinto), "nro_mesa": int(codigo_mesa)},
            {"habilitados": 1},
        )
        if mesa_doc:
            habilitados = mesa_doc.get("habilitados")

    if habilitados is None:
        habilitados = acta.get("ciudadanos_habilitados")
        if habilitados is not None:
            advertencias.append("Habilitados tomados del OCR (mesa no encontrada en catálogo)")
        else:
            advertencias.append("No se pudo verificar cantidad de habilitados")

    # ── E. Aritmética 1: suma candidatos == votos_validos ───────────────────
    total_candidatos = sum(c.get("votos", 0) for c in candidatos)
    val.suma_candidatos = (total_candidatos == validos)

    if not val.suma_candidatos:
        return _no_computable(
            id_acta,
            f"Inconsistencia aritmética: suma candidatos ({total_candidatos}) ≠ votos válidos ({validos})",
            errores=[f"INCONSISTENCIA_ARITMETICA: total_candidatos={total_candidatos} != votos_validos={validos}"],
            advertencias=advertencias,
            posible_nulidad=True,
            validaciones=val,
            observacion_detectada=obs_detectada,
            observacion_fuera_recuadro=obs_fuera,
        )

    # ── F. Aritmética 2: válidos + blancos + nulos == total emitido ─────────
    votos_emitidos_calculados = validos + blancos + nulos
    total_emitidos_acta = acta.get("total_emitidos")

    if total_emitidos_acta is not None:
        val.suma_emitidos = (votos_emitidos_calculados == int(total_emitidos_acta))
        if not val.suma_emitidos:
            return _no_computable(
                id_acta,
                f"Inconsistencia: válidos+blancos+nulos ({votos_emitidos_calculados}) ≠ total emitido ({total_emitidos_acta})",
                errores=[f"INCONSISTENCIA_EMITIDOS: calculado={votos_emitidos_calculados} != total_emitidos={total_emitidos_acta}"],
                advertencias=advertencias,
                posible_nulidad=True,
                validaciones=val,
                observacion_detectada=obs_detectada,
                observacion_fuera_recuadro=obs_fuera,
            )
    else:
        val.suma_emitidos = True  # sin campo separado se usa el calculado

    # ── G. Votos emitidos no superan habilitados ────────────────────────────
    if habilitados is not None:
        val.votos_no_superan_habilitados = (votos_emitidos_calculados <= habilitados)
        if not val.votos_no_superan_habilitados:
            return _no_computable(
                id_acta,
                f"Votos emitidos ({votos_emitidos_calculados}) superan habilitados ({habilitados})",
                errores=[f"VOTOS_SUPERAN_HABILITADOS: emitidos={votos_emitidos_calculados} > habilitados={habilitados}"],
                advertencias=advertencias,
                posible_nulidad=True,
                validaciones=val,
                observacion_detectada=obs_detectada,
                observacion_fuera_recuadro=obs_fuera,
            )
    else:
        val.votos_no_superan_habilitados = True

    # ── H. Duplicados ────────────────────────────────────────────────────────
    duplicado = db.actas.find_one(
        {
            "codigo_mesa":   codigo_mesa,
            "codigo_recinto": codigo_recinto,
            "estado":        ESTADO_COMPUTABLE,
            "id_acta":       {"$ne": id_acta},
        },
        {"id_acta": 1, "votos": 1},
    )

    if duplicado:
        dup_votos = duplicado.get("votos") or {}
        mismo_resultado = (
            dup_votos.get("validos") == validos
            and dup_votos.get("blancos") == blancos
            and dup_votos.get("nulos") == nulos
        )
        val.duplicado_conflictivo = not mismo_resultado

        if not mismo_resultado:
            return _no_computable(
                id_acta,
                f"Duplicado conflictivo: acta {duplicado['id_acta']} ya computable con datos distintos",
                errores=[f"DUPLICADO_CONFLICTIVO: id_existente={duplicado['id_acta']}"],
                advertencias=advertencias,
                posible_nulidad=True,
                validaciones=val,
                observacion_detectada=obs_detectada,
                observacion_fuera_recuadro=obs_fuera,
            )
        else:
            advertencias.append(
                f"Acta duplicada ignorada por idempotencia (id={duplicado['id_acta']})"
            )
            db.vista_actas_estado.update_one(
                {"_id": "global"}, {"$inc": {"duplicados_ignorados": 1}}
            )
    else:
        val.duplicado_conflictivo = False

    # ── I. COMPUTABLE_RRV ────────────────────────────────────────────────────
    alerta_legal = obs_fuera  # obs sin afectar campos → computable pero con alerta
    motivo = (
        "Observación fuera del recuadro, sin afectar campos obligatorios"
        if obs_fuera
        else "Todos los campos obligatorios completos y consistentes"
    )

    return ValidationResultRRV(
        acta_id=id_acta,
        estado_rrv=ESTADO_COMPUTABLE,
        publicar_rrv=True,
        motivo_rrv=motivo,
        errores=[],
        advertencias=advertencias,
        observacion_detectada=obs_detectada,
        observacion_fuera_recuadro=obs_fuera,
        observacion_afecta_campos_obligatorios=False,
        posible_nulidad_legal=False,
        alerta_legal=alerta_legal,
        validaciones=val,
    )
