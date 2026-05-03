from typing import Protocol


class MesaRepository(Protocol):
    """Contrato para verificar la existencia de mesas en el catálogo OEP.

    Sólo expone `existe()` porque ese es el único uso del repo en el flujo
    de registro de recuento (Error3). Si en el futuro hace falta listar o
    buscar por recinto, agregamos métodos al Protocol.
    """

    async def existe(self, codigo_mesa: int) -> bool: ...
