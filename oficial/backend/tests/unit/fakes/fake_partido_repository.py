from recuento_oficial.domain.entities.partido import Partido


class FakePartidoRepository:
    def __init__(self, partidos: list[Partido] | None = None) -> None:
        self._partidos = partidos or self._default_seed()

    async def list_all(self) -> list[Partido]:
        return list(self._partidos)

    async def get_by_id(self, id_partido: int) -> Partido | None:
        for p in self._partidos:
            if p.id_partido == id_partido:
                return p
        return None

    @staticmethod
    def _default_seed() -> list[Partido]:
        return [
            Partido(1, "P1", "Daenerys Targaryen", "MAS-ISP", "#003087", 1),
            Partido(2, "P2", "Sansa Stark", "CC", "#E63946", 2),
            Partido(3, "P3", "Robert Baratheon", "Creemos", "#F4A261", 3),
            Partido(4, "P4", "Tyrion Lannister", "APB", "#2A9D8F", 4),
        ]
