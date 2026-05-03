class FakeMesaRepository:
    """Fake en memoria para `MesaRepository`.

    Default: toda mesa existe (`existe()` retorna True para cualquier código).
    Configurable vía:
      - `set_existe(value)`: cambia el default global.
      - `set_existe_para(codigo_mesa, value)`: override por código (gana
        sobre el default).
    """

    def __init__(self) -> None:
        self._default = True
        self._overrides: dict[int, bool] = {}

    def set_existe(self, value: bool) -> None:
        self._default = value
        self._overrides.clear()

    def set_existe_para(self, codigo_mesa: int, value: bool) -> None:
        self._overrides[codigo_mesa] = value

    async def existe(self, codigo_mesa: int) -> bool:
        return self._overrides.get(codigo_mesa, self._default)
