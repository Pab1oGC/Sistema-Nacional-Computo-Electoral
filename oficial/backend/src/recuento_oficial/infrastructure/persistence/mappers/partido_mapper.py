from recuento_oficial.domain.entities.partido import Partido
from recuento_oficial.infrastructure.persistence.models.partido_orm import PartidoORM


def orm_to_entity(orm: PartidoORM) -> Partido:
    return Partido(
        id_partido=orm.id_partido,
        sigla_candidato=orm.sigla_candidato,
        nombre_candidato=orm.nombre_candidato,
        sigla_partido=orm.sigla_partido,
        color_hex=orm.color_hex,
        orden_papeleta=orm.orden_papeleta,
    )
