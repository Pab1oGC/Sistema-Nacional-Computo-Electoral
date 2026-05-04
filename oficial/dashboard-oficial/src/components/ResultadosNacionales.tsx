import { useResultados } from '../hooks/useResultados';
import { TarjetaCandidato } from './TarjetaCandidato';

export function ResultadosNacionales() {
  const { data, isLoading, isError } = useResultados();

  if (isLoading) {
    return (
      <section aria-labelledby="resultados-titulo">
        <h2 id="resultados-titulo" className="text-lg font-semibold mb-4">
          Resultados nacionales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-oficial-card border border-oficial-border rounded-lg p-5 animate-pulse"
              aria-hidden="true"
            >
              <div className="h-10 w-10 bg-oficial-border rounded mb-4" />
              <div className="h-4 bg-oficial-border rounded w-3/4 mb-2" />
              <div className="h-4 bg-oficial-border rounded w-1/2 mb-4" />
              <div className="h-8 bg-oficial-border rounded w-1/3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section aria-labelledby="resultados-titulo">
        <h2 id="resultados-titulo" className="text-lg font-semibold mb-4">
          Resultados nacionales
        </h2>
        <p className="bg-oficial-card border border-oficial-border rounded-lg p-5 text-oficial-text-secondary">
          No fue posible cargar los datos. Reintentando...
        </p>
      </section>
    );
  }

  if (data.candidatos.length === 0 || data.total_votos_validos === 0) {
    return (
      <section aria-labelledby="resultados-titulo">
        <h2 id="resultados-titulo" className="text-lg font-semibold mb-4">
          Resultados nacionales
        </h2>
        <p className="bg-oficial-card border border-oficial-border rounded-lg p-5 text-oficial-text-secondary">
          Aún no se han recibido actas oficiales.
        </p>
      </section>
    );
  }

  // Ganador = mayor porcentaje. Empate: gana el primero por orden_papeleta.
  const ganador = data.candidatos.reduce((a, b) =>
    a.porcentaje >= b.porcentaje ? a : b,
  );

  // Mostramos en orden de papeleta para consistencia visual.
  const candidatos = [...data.candidatos].sort(
    (a, b) => a.orden_papeleta - b.orden_papeleta,
  );

  return (
    <section aria-labelledby="resultados-titulo">
      <h2 id="resultados-titulo" className="text-lg font-semibold mb-4">
        Resultados nacionales
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {candidatos.map((c) => (
          <TarjetaCandidato
            key={c.candidato_id}
            candidato={c}
            esGanador={c.candidato_id === ganador.candidato_id}
          />
        ))}
      </div>
    </section>
  );
}
