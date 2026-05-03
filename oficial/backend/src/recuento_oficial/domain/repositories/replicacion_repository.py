from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class EstadoReplicacion:
    master_host: str
    replica_host: str | None
    sync_state: str
    state: str
    lag_bytes: int
    ultima_verificacion: datetime


class ReplicacionRepository(Protocol):
    async def consultar_estado(self) -> EstadoReplicacion: ...
