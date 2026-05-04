from __future__ import annotations

from typing import Protocol


class ActasDescartadasRepository(Protocol):
    """Contrato para la tabla de cuarentena oficial.actas_descartadas.

    Hoy solo expone count y truncate; insertions son responsabilidad de
    los procesos de ingest (CSV loader, n8n) que las pueblan vía SQL
    directo o vía SQLAlchemy en otro lado del código.
    """

    async def count_all(self) -> int: ...

    async def truncate_all(self) -> None: ...
