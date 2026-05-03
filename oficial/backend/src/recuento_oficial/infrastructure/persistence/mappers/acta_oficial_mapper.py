from recuento_oficial.domain.entities.acta_oficial import ActaOficial
from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (
    ActaOficialORM,
)


def entity_to_orm(entity: ActaOficial) -> ActaOficialORM:
    return ActaOficialORM(
        id_acta=entity.id_acta,
        codigo_acta=entity.codigo_acta,
        codigo_mesa=entity.codigo_mesa,
        votos_p1=entity.votos_p1,
        votos_p2=entity.votos_p2,
        votos_p3=entity.votos_p3,
        votos_p4=entity.votos_p4,
        blancos=entity.blancos,
        nulos=entity.nulos,
        habilitados=entity.habilitados,
        anfora=entity.anfora,
        no_usadas=entity.no_usadas,
        apertura_hora=entity.apertura_hora,
        apertura_minutos=entity.apertura_minutos,
        cierre_hora=entity.cierre_hora,
        cierre_minutos=entity.cierre_minutos,
        fecha_creacion=entity.fecha_creacion,
    )


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
        apertura_hora=orm.apertura_hora,
        apertura_minutos=orm.apertura_minutos,
        cierre_hora=orm.cierre_hora,
        cierre_minutos=orm.cierre_minutos,
        fecha_creacion=orm.fecha_creacion,
    )
