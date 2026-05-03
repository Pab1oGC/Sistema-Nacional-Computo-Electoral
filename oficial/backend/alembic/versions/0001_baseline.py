"""baseline NO-OP

El schema inicial NO se crea aquí. Vive en `oficial/sql/01-schema.sql`
(hand-written) por decisión arquitectónica documentada en
`oficial/docs/architecture/05-replication-mirror.md`.

Esta revisión existe únicamente para que `alembic_version` apunte a
0001_baseline después de aplicar el SQL inicial. Migraciones posteriores
descenderán de esta.

Para inicializar:

    docker exec -i oficial_master psql -U postgres -d oficial < sql/01-schema.sql
    alembic stamp 0001

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-03
"""

from typing import Sequence, Union

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
