from dataclasses import dataclass


@dataclass
class Municipio:
    """Municipio boliviano.

    Nota sobre el bug del Excel del docente: la hoja DistribucionTerritorial
    tiene las columnas "Municipio" y "Provincia" invertidas. En esta entity
    los campos están con su semántica correcta. Ver `oficial/CLAUDE.md` sec 8
    y `sql/04-carga-datos.sql` para la inversión en la carga.
    """

    codigo: str
    nombre: str
    provincia: str
    codigo_departamento: int
