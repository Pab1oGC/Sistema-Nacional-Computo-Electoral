"""Composition root: cablea todas las capas.

ÚNICO archivo del proyecto que conoce los nombres concretos de las
implementaciones (`Sqla*Repository`). Routers y use cases dependen solo de
los `Protocol` del dominio, así que un cambio de implementación de
persistencia (e.g. fakes en tests) toca este archivo y nada más.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from recuento_oficial.application.use_cases.consultar_avance_use_case import (
    ConsultarAvanceUseCase,
)
from recuento_oficial.application.use_cases.consultar_replicacion_use_case import (
    ConsultarReplicacionUseCase,
)
from recuento_oficial.application.use_cases.consultar_resultados_por_departamento_use_case import (
    ConsultarResultadosPorDepartamentoUseCase,
)
from recuento_oficial.application.use_cases.consultar_resultados_por_municipio_use_case import (
    ConsultarResultadosPorMunicipioUseCase,
)
from recuento_oficial.application.use_cases.consultar_resultados_use_case import (
    ConsultarResultadosUseCase,
)
from recuento_oficial.application.use_cases.listar_actas_use_case import (
    ConsultarActaUseCase,
    ListarActasUseCase,
)
from recuento_oficial.application.use_cases.listar_candidatos_use_case import (
    ListarCandidatosUseCase,
)
from recuento_oficial.application.use_cases.listar_inconsistencias_use_case import (
    ListarInconsistenciasUseCase,
)
from recuento_oficial.application.use_cases.registrar_recuento_use_case import (
    RegistrarRecuentoUseCase,
)
from recuento_oficial.domain.repositories.acta_oficial_repository import (
    ActaOficialRepository,
)
from recuento_oficial.domain.repositories.inconsistencia_repository import (
    InconsistenciaRepository,
)
from recuento_oficial.domain.repositories.mesa_repository import MesaRepository
from recuento_oficial.domain.repositories.partido_repository import PartidoRepository
from recuento_oficial.domain.repositories.replicacion_repository import (
    ReplicacionRepository,
)
from recuento_oficial.domain.services.validador_acta import ValidadorActa
from recuento_oficial.infrastructure.persistence.repositories.sqla_acta_oficial_repository import (
    SqlaActaOficialRepository,
)
from recuento_oficial.infrastructure.persistence.repositories.sqla_inconsistencia_repository import (
    SqlaInconsistenciaRepository,
)
from recuento_oficial.infrastructure.persistence.repositories.sqla_mesa_repository import (
    SqlaMesaRepository,
)
from recuento_oficial.infrastructure.persistence.repositories.sqla_partido_repository import (
    SqlaPartidoRepository,
)
from recuento_oficial.infrastructure.persistence.repositories.sqla_replicacion_repository import (
    SqlaReplicacionRepository,
)
from shared.infrastructure.database.session import get_session

# ─── Session dependency ───────────────────────────────────────────────────
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# ─── Repository providers ─────────────────────────────────────────────────
def get_acta_repo(session: SessionDep) -> ActaOficialRepository:
    return SqlaActaOficialRepository(session)


def get_partido_repo(session: SessionDep) -> PartidoRepository:
    return SqlaPartidoRepository(session)


def get_inconsistencia_repo(session: SessionDep) -> InconsistenciaRepository:
    return SqlaInconsistenciaRepository(session)


def get_replicacion_repo(session: SessionDep) -> ReplicacionRepository:
    return SqlaReplicacionRepository(session)


def get_mesa_repo(session: SessionDep) -> MesaRepository:
    return SqlaMesaRepository(session)


ActaRepoDep = Annotated[ActaOficialRepository, Depends(get_acta_repo)]
PartidoRepoDep = Annotated[PartidoRepository, Depends(get_partido_repo)]
InconsistenciaRepoDep = Annotated[
    InconsistenciaRepository, Depends(get_inconsistencia_repo)
]
ReplicacionRepoDep = Annotated[ReplicacionRepository, Depends(get_replicacion_repo)]
MesaRepoDep = Annotated[MesaRepository, Depends(get_mesa_repo)]


# ─── Use case providers ───────────────────────────────────────────────────
def get_registrar_use_case(
    acta_repo: ActaRepoDep,
    mesa_repo: MesaRepoDep,
    inc_repo: InconsistenciaRepoDep,
) -> RegistrarRecuentoUseCase:
    return RegistrarRecuentoUseCase(acta_repo, mesa_repo, inc_repo, ValidadorActa())


def get_consultar_resultados_use_case(
    acta_repo: ActaRepoDep, partido_repo: PartidoRepoDep
) -> ConsultarResultadosUseCase:
    return ConsultarResultadosUseCase(acta_repo, partido_repo)


def get_consultar_resultados_por_depto_use_case(
    acta_repo: ActaRepoDep, partido_repo: PartidoRepoDep
) -> ConsultarResultadosPorDepartamentoUseCase:
    return ConsultarResultadosPorDepartamentoUseCase(acta_repo, partido_repo)


def get_consultar_resultados_por_municipio_use_case(
    acta_repo: ActaRepoDep, partido_repo: PartidoRepoDep
) -> ConsultarResultadosPorMunicipioUseCase:
    return ConsultarResultadosPorMunicipioUseCase(acta_repo, partido_repo)


def get_consultar_avance_use_case(acta_repo: ActaRepoDep) -> ConsultarAvanceUseCase:
    return ConsultarAvanceUseCase(acta_repo)


def get_listar_actas_use_case(acta_repo: ActaRepoDep) -> ListarActasUseCase:
    return ListarActasUseCase(acta_repo)


def get_consultar_acta_use_case(acta_repo: ActaRepoDep) -> ConsultarActaUseCase:
    return ConsultarActaUseCase(acta_repo)


def get_listar_inconsistencias_use_case(
    inc_repo: InconsistenciaRepoDep,
) -> ListarInconsistenciasUseCase:
    return ListarInconsistenciasUseCase(inc_repo)


def get_listar_candidatos_use_case(
    partido_repo: PartidoRepoDep,
) -> ListarCandidatosUseCase:
    return ListarCandidatosUseCase(partido_repo)


def get_consultar_replicacion_use_case(
    replicacion_repo: ReplicacionRepoDep,
) -> ConsultarReplicacionUseCase:
    return ConsultarReplicacionUseCase(replicacion_repo)


RegistrarUseCaseDep = Annotated[
    RegistrarRecuentoUseCase, Depends(get_registrar_use_case)
]
ConsultarResultadosUseCaseDep = Annotated[
    ConsultarResultadosUseCase, Depends(get_consultar_resultados_use_case)
]
ConsultarResultadosPorDeptoUseCaseDep = Annotated[
    ConsultarResultadosPorDepartamentoUseCase,
    Depends(get_consultar_resultados_por_depto_use_case),
]
ConsultarResultadosPorMunicipioUseCaseDep = Annotated[
    ConsultarResultadosPorMunicipioUseCase,
    Depends(get_consultar_resultados_por_municipio_use_case),
]
ConsultarAvanceUseCaseDep = Annotated[
    ConsultarAvanceUseCase, Depends(get_consultar_avance_use_case)
]
ListarActasUseCaseDep = Annotated[ListarActasUseCase, Depends(get_listar_actas_use_case)]
ConsultarActaUseCaseDep = Annotated[
    ConsultarActaUseCase, Depends(get_consultar_acta_use_case)
]
ListarInconsistenciasUseCaseDep = Annotated[
    ListarInconsistenciasUseCase, Depends(get_listar_inconsistencias_use_case)
]
ListarCandidatosUseCaseDep = Annotated[
    ListarCandidatosUseCase, Depends(get_listar_candidatos_use_case)
]
ConsultarReplicacionUseCaseDep = Annotated[
    ConsultarReplicacionUseCase, Depends(get_consultar_replicacion_use_case)
]
