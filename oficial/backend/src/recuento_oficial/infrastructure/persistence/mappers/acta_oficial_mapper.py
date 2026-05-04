from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (
    ActaOficialORM,
)


def entity_to_orm(entity: ActaOficial) -> ActaOficialORM:
    """Convierte entidad de dominio a ORM.

    id_acta=None deja que la BD asigne BIGSERIAL en el INSERT.
    fecha_procesado=None deja que la BD use DEFAULT NOW().
    """
    kwargs: dict = {
        "codigo_acta": entity.codigo_acta,
        "codigo_mesa": entity.codigo_mesa,
        "votos_p1": entity.votos_p1,
        "votos_p2": entity.votos_p2,
        "votos_p3": entity.votos_p3,
        "votos_p4": entity.votos_p4,
        "blancos": entity.blancos,
        "nulos": entity.nulos,
        "habilitados": entity.habilitados,
        "anfora": entity.anfora,
        "no_usadas": entity.no_usadas,
        "observacion_formal": entity.observacion_formal,
        "tipo_observacion_formal": entity.tipo_observacion_formal,
    }
    if entity.id_acta is not None:
        kwargs["id_acta"] = entity.id_acta
    return ActaOficialORM(**kwargs)


def orm_to_entity(orm: ActaOficialORM) -> ActaOficial:
    return ActaOficial(
        id_acta=orm.id_acta,
        codigo_acta=orm.codigo_acta,
        codigo_mesa=orm.codigo_mesa,
        votos_p1=orm.votos_p1,
        votos_p2=orm.votos_p2,
        votos_p3=orm.votos_p3,
        votos_p4=orm.votos_p4,
        blancos=orm.blancos,
        nulos=orm.nulos,
        habilitados=orm.habilitados,
        anfora=orm.anfora,
        no_usadas=orm.no_usadas,
        observacion_formal=orm.observacion_formal,
        tipo_observacion_formal=orm.tipo_observacion_formal,
        fecha_procesado=orm.fecha_procesado,
    )
