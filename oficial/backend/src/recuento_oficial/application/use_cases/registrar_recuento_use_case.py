import logging
from datetime import datetime, timezone

from recuento_oficial.application.dtos.registrar_recuento_dto import (
    RegistrarRecuentoDTO,
)
from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.domain.exceptions import (
    ActaNoExisteException,
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
from recuento_oficial.domain.repositories.mesa_repository import MesaRepository
from recuento_oficial.domain.services.validador_acta import ValidadorActa

logger = logging.getLogger(__name__)


class RegistrarRecuentoUseCase:
    def __init__(
        self,
        repo: ActaOficialRepository,
        mesa_repo: MesaRepository,
        inconsistencia_repo: InconsistenciaRepository,
        validador: ValidadorActa,
    ) -> None:
        self._repo = repo
        self._mesa_repo = mesa_repo
        self._inconsistencias = inconsistencia_repo
        self._validador = validador

    async def execute(self, dto: RegistrarRecuentoDTO) -> ActaOficial:
        # Orden: Error3 → Error4 → Error1+2.
        # Fail fast desde lo estructural (mesa no existe en el catálogo)
        # a lo aritmético (papeletas no balancean). Si la mesa no existe,
        # ni siquiera tiene sentido chequear duplicados ni validar cuentas:
        # toda la cadena de FK estaría rota.

        # Error3: ¿la mesa existe en oficial.mesa?
        if not await self._mesa_repo.existe(dto.codigo_mesa):
            exc = ActaNoExisteException(str(dto.codigo_acta))
            await self._persistir_error3(dto, str(exc))
            # Commit explícito ANTES del raise: el rollback automático de
            # FastAPI al excepcionar destruiría el INSERT al
            # log_inconsistencias. La excepción de dominio NO debe
            # cancelar el audit trail.
            await self._inconsistencias.commit_pendiente()
            raise exc

        # Error4: idempotencia basada en UNIQUE(codigo_acta) del schema v2.
        if await self._repo.exists_by_codigo(dto.codigo_acta):
            raise ActaYaProcesadaException(str(dto.codigo_acta))

        acta = ActaOficial(
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
            observacion_formal=dto.observacion_formal,
            tipo_observacion_formal=dto.tipo_observacion_formal,
        )

        # Error1+Error2: aritmética (puro, sin BD)
        try:
            self._validador.validar(acta)
        except ErroresDeValidacionException as exc:
            await self._persistir_inconsistencias(acta, exc.errores)
            # Commit explícito ANTES del raise: el rollback automático de
            # FastAPI al excepcionar destruiría los INSERTs al
            # log_inconsistencias. La excepción de dominio NO debe
            # cancelar el audit trail.
            await self._inconsistencias.commit_pendiente()
            raise

        await self._repo.save(acta)
        return acta

    async def _persistir_error3(
        self, dto: RegistrarRecuentoDTO, mensaje: str
    ) -> None:
        """Persiste un registro Error3 en log_inconsistencias.

        Si falla (e.g., BD intermitente), loguea el error pero NO bloquea
        la respuesta 404 al cliente. La excepción de dominio tiene
        prioridad sobre el audit trail.
        """
        try:
            valores: dict[str, int | str] = {
                "codigo_acta": dto.codigo_acta,
                "codigo_mesa": dto.codigo_mesa,
                "habilitados": dto.habilitados,
                "anfora": dto.anfora,
                "no_usadas": dto.no_usadas,
                "votos_p1": dto.votos_p1,
                "votos_p2": dto.votos_p2,
                "votos_p3": dto.votos_p3,
                "votos_p4": dto.votos_p4,
                "blancos": dto.blancos,
                "nulos": dto.nulos,
            }
            await self._inconsistencias.save(
                Inconsistencia(
                    codigo_acta=str(dto.codigo_acta),
                    codigo_mesa=dto.codigo_mesa,
                    tipo="ERROR3",
                    mensaje=mensaje,
                    valores_recibidos=valores,
                    timestamp=datetime.now(timezone.utc),
                )
            )
        except Exception as exc:
            logger.warning(
                "No se pudo persistir Error3 para acta %s en log_inconsistencias: %s",
                dto.codigo_acta,
                exc,
            )

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
                    codigo_acta=str(acta.codigo_acta),
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
        # oficial.log_inconsistencias.tipo (ver sql/01-schema-v2.sql).
        if "papeletas no usadas" in mensaje:
            return "ERROR1"
        return "ERROR2"
