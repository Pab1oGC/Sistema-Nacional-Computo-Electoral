class FakeActasDescartadasRepository:
    """Fake en memoria del Protocol ActasDescartadasRepository.

    Solo lleva un contador para los tests del use case de reset; no hay
    persistencia real ni tipo de fila — basta con saber cuántas había
    antes y verificar que truncate las baja a 0.
    """

    def __init__(self, initial_count: int = 0) -> None:
        self._count = initial_count

    def set_count(self, n: int) -> None:
        """Helper de tests: presea la cantidad inicial."""
        self._count = n

    async def count_all(self) -> int:
        return self._count

    async def truncate_all(self) -> None:
        self._count = 0
