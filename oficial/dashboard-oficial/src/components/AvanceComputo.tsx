import { useAvance } from '../hooks/useAvance';
import { formatearNumero } from '../utils/formatearNumero';
import { formatearPorcentaje } from '../utils/formatearPorcentaje';

export function AvanceComputo() {
  const { data, isLoading, isError } = useAvance();

  if (isLoading) {
    return (
      <section aria-labelledby="avance-titulo">
        <h2 id="avance-titulo" className="text-lg font-semibold mb-4">
          Avance del cómputo
        </h2>
        <div
          className="bg-oficial-card border border-oficial-border rounded-lg p-6 animate-pulse"
          aria-hidden="true"
        >
          <div className="h-6 bg-oficial-border rounded w-1/3 mb-4" />
          <div className="h-3 bg-oficial-border rounded w-full" />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section aria-labelledby="avance-titulo">
        <h2 id="avance-titulo" className="text-lg font-semibold mb-4">
          Avance del cómputo
        </h2>
        <p className="bg-oficial-card border border-oficial-border rounded-lg p-5 text-oficial-text-secondary">
          No fue posible cargar los datos. Reintentando...
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="avance-titulo">
      <h2 id="avance-titulo" className="text-lg font-semibold mb-4">
        Avance del cómputo
      </h2>
      <div className="bg-oficial-card border border-oficial-border rounded-lg p-6">
        <div className="flex flex-wrap justify-between items-baseline gap-3 mb-3">
          <p className="text-3xl font-bold tabular-nums text-oficial-blue">
            {formatearPorcentaje(data.porcentaje_avance)}
          </p>
          <p className="text-sm text-oficial-text-secondary tabular-nums">
            {formatearNumero(data.actas_validadas)} de{' '}
            {formatearNumero(data.total_mesas)} mesas
          </p>
        </div>
        <div
          className="h-4 bg-oficial-border rounded overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(data.porcentaje_avance)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Avance del ${formatearPorcentaje(data.porcentaje_avance)}`}
        >
          <div
            className="h-full bg-oficial-blue transition-all duration-500"
            style={{ width: `${Math.min(data.porcentaje_avance, 100)}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-oficial-text-secondary">Actas procesadas</p>
            <p className="font-semibold tabular-nums">
              {formatearNumero(data.actas_validadas)}
            </p>
          </div>
          <div>
            <p className="text-oficial-text-secondary">Pendientes</p>
            <p className="font-semibold tabular-nums">
              {formatearNumero(data.actas_pendientes)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
