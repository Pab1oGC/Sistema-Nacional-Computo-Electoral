from datetime import datetime, timezone

from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.exceptions import (
    ActaYaProcesadaException,
    ErroresDeValidacionException,
)
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)
from recuento_oficial.domain.repositories.inconsistencia_repository import (
    Inconsistencia,
    InconsistenciaRepository,
)
from recuento_oficial.domain.services.validador_acta import ValidadorActa


class RegistrarRecuentoUseCase:
    def __init__(
        self,
        repo: ActaOficialRepository,
        inconsistencia_repo: InconsistenciaRepository,
        validador: ValidadorActa,
    ) -> None:
        self._repo = repo
        self._inconsistencias = inconsistencia_repo
        self._validador = validador

    async def execute(self, dto: RegistrarRecuentoDTO) -> ActaOficial:
        if await self._repo.exists(dto.id_acta):
            raise ActaYaProcesadaException(dto.codigo_acta)

        acta = ActaOficial(
            id_acta=dto.id_acta,
            codigo_acta=dto.codigo_acta,
            codigo_mesa=dto.codigo_mesa,
            votos_p1=dto.votos_p1,
            votos_p2=dto.votos_p2,
            votos_p3=dto.votos_p3,
            votos_p4=dto.votos_p4,
            blancos=dto.blancos,
            nulos=dto.nulos,
            habilitados=dto.habilitados,
            anfora=dto.anfora,
            no_usadas=dto.no_usadas,
            apertura_hora=dto.apertura_hora,
            apertura_minutos=dto.apertura_minutos,
            cierre_hora=dto.cierre_hora,
            cierre_minutos=dto.cierre_minutos,
        )

        try:
            self._validador.validar(acta)
        except ErroresDeValidacionException as exc:
            await self._persistir_inconsistencias(acta, exc.errores)
            raise

        await self._repo.save(acta)
        return acta

    async def _persistir_inconsistencias(
        self, acta: ActaOficial, errores: list[str]
    ) -> None:
        now = datetime.now(timezone.utc)
        valores = {
            "habilitados": acta.habilitados,
            "anfora": acta.anfora,
            "no_usadas": acta.no_usadas,
            "votos_p1": acta.votos_p1,
            "votos_p2": acta.votos_p2,
            "votos_p3": acta.votos_p3,
            "votos_p4": acta.votos_p4,
            "blancos": acta.blancos,
            "nulos": acta.nulos,
        }
        for mensaje in errores:
            tipo = self._clasificar_tipo(mensaje)
            await self._inconsistencias.save(
                Inconsistencia(
                    codigo_acta=acta.codigo_acta,
                    codigo_mesa=acta.codigo_mesa,
                    tipo=tipo,
                    mensaje=mensaje,
                    valores_recibidos=valores,
                    timestamp=now,
                )
            )

    @staticmethod
    def _clasificar_tipo(mensaje: str) -> str:
        # MAYÚSCULAS para matchear el CHECK constraint de
        # oficial.log_inconsistencias.tipo (ver sql/01-schema.sql).
        if "papeletas no usadas" in mensaje:
            return "ERROR1"
        return "ERROR2"
