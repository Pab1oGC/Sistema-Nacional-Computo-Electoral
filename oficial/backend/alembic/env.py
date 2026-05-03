"""Alembic env async para migraciones incrementales.

El schema inicial vive en `oficial/sql/01-schema.sql` (hand-written, fuente de
verdad). La migración 0001 es NO-OP. Migraciones posteriores nacen acá.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Importar todos los ORM models para registrarlos en Base.metadata
from recuento_oficial.infrastructure.persistence.models.acta_oficial_orm import (  # noqa: F401
    ActaOficialORM,
)
from recuento_oficial.infrastructure.persistence.models.departamento_orm import (  # noqa: F401
    DepartamentoORM,
)
from recuento_oficial.infrastructure.persistence.models.inconsistencia_orm import (  # noqa: F401
    InconsistenciaORM,
)
from recuento_oficial.infrastructure.persistence.models.mesa_orm import (  # noqa: F401
    MesaORM,
)
from recuento_oficial.infrastructure.persistence.models.municipio_orm import (  # noqa: F401
    MunicipioORM,
)
from recuento_oficial.infrastructure.persistence.models.partido_orm import (  # noqa: F401
    PartidoORM,
)
from recuento_oficial.infrastructure.persistence.models.recinto_orm import (  # noqa: F401
    RecintoORM,
)
from shared.infrastructure.database.base import Base
from shared.infrastructure.database.settings import get_settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return get_settings().db_url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {}) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
