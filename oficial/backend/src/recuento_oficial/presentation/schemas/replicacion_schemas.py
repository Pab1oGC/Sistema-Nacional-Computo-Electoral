from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReplicacionEstadoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    master_host: str
    replica_host: str | None
    sync_state: str
    state: str
    lag_bytes: int
    ultima_verificacion: datetime
