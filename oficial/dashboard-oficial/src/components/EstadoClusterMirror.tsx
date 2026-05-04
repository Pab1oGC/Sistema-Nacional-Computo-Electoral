import { useReplicacionEstado } from '../hooks/useReplicacionEstado';
import { formatearNumero } from '../utils/formatearNumero';

export function EstadoClusterMirror() {
  const { data, isLoading, isError } = useReplicacionEstado();

  if (isLoading) {
    return (
      <section aria-labelledby="cluster-titulo">
        <h2 id="cluster-titulo" className="text-lg font-semibold mb-4">
          Estado del cluster Mirror
        </h2>
        <div
          className="bg-oficial-card border border-oficial-border rounded-lg p-6 animate-pulse"
          aria-hidden="true"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-20 bg-oficial-border rounded" />
            <div className="h-20 bg-oficial-border rounded" />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section aria-labelledby="cluster-titulo">
        <h2 id="cluster-titulo" className="text-lg font-semibold mb-4">
          Estado del cluster Mirror
        </h2>
        <p className="bg-oficial-card border border-oficial-border rounded-lg p-5 text-oficial-text-secondary">
          No fue posible verificar la replicación. Reintentando...
        </p>
      </section>
    );
  }

  const replicaSincronizada =
    data.state === 'streaming' && data.sync_state === 'sync';

  return (
    <section aria-labelledby="cluster-titulo">
      <h2 id="cluster-titulo" className="text-lg font-semibold mb-4">
        Estado del cluster Mirror
      </h2>
      <div className="bg-oficial-card border border-oficial-border rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NodoCard
            etiqueta="Master (primario)"
            host={data.master_host}
            estadoOk
            estadoTexto="Activo · acepta escrituras"
          />
          <NodoCard
            etiqueta="Réplica (standby)"
            host={data.replica_host ?? '—'}
            estadoOk={replicaSincronizada}
            estadoTexto={
              replicaSincronizada
                ? 'Sincronizada · streaming'
                : 'Desconectada o degradada'
            }
          />
        </div>
        <div className="mt-5 pt-4 border-t border-oficial-border flex flex-col md:flex-row justify-between gap-2 text-sm text-oficial-text-secondary">
          <p>
            <span className="font-medium text-oficial-text">Lag de replicación:</span>{' '}
            {data.lag_bytes === 0
              ? 'sin lag (datos idénticos)'
              : `${formatearNumero(data.lag_bytes)} bytes`}
          </p>
          <p>
            <span className="font-medium text-oficial-text">Última verificación:</span>{' '}
            {tiempoRelativo(data.ultima_verificacion)}
          </p>
        </div>
      </div>
    </section>
  );
}

interface NodoCardProps {
  etiqueta: string;
  host: string;
  estadoOk: boolean;
  estadoTexto: string;
}

function NodoCard({ etiqueta, host, estadoOk, estadoTexto }: NodoCardProps) {
  const colorEstado = estadoOk ? 'text-oficial-green' : 'text-oficial-yellow';
  return (
    <article aria-label={etiqueta}>
      <p className="text-xs uppercase tracking-wide text-oficial-text-secondary mb-1">
        {etiqueta}
      </p>
      <p className="font-mono text-base mb-2 break-all">{host}</p>
      <p className={`text-sm font-medium flex items-center gap-2 ${colorEstado}`}>
        <span aria-hidden="true">{estadoOk ? '✓' : '⚠'}</span>
        {estadoTexto}
      </p>
    </article>
  );
}

function tiempoRelativo(isoString: string): string {
  const date = new Date(isoString);
  const segundos = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (segundos < 60) {
    return `hace ${segundos} segundo${segundos === 1 ? '' : 's'}`;
  }
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    return `hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  }
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} hora${horas === 1 ? '' : 's'}`;
}
