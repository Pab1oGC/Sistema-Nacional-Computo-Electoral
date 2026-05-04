import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface ConteoObservacionFormal {
  tipo: string;
  cantidad: number;
  descripcion_humana: string;
}

interface ObservacionesFormalesResponse {
  total: number;
  conteos_por_tipo: ConteoObservacionFormal[];
}

interface InconsistenciaItem {
  id_inconsistencia: number | null;
  codigo_acta: string;
  codigo_mesa: number;
  tipo: string;
  mensaje: string;
  timestamp: string;
}

interface ListaInconsistenciasResponse {
  total: number;
  page: number;
  limit: number;
  items: InconsistenciaItem[];
  tipo_mas_comun: string | null;
}

const TIPOS_FILTRABLES: ReadonlyArray<{ valor: string; label: string }> = [
  { valor: '', label: 'Todos' },
  { valor: 'ERROR1', label: 'ERROR1 — Balance papeletas' },
  { valor: 'ERROR2', label: 'ERROR2 — Balance votos' },
  { valor: 'ERROR3', label: 'ERROR3 — Mesa inexistente' },
  { valor: 'ERROR4', label: 'ERROR4 — Idempotencia' },
  { valor: 'INCONSISTENCIA_NUMERICA', label: 'INCONSISTENCIA_NUMERICA' },
];

const POLLING_MS = 10_000;

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}

function exportarCSV(items: InconsistenciaItem[]): void {
  const header = 'fecha,codigo_acta,codigo_mesa,tipo,mensaje\n';
  const rows = items
    .map(
      (i) =>
        `${i.timestamp},${i.codigo_acta},${i.codigo_mesa},${i.tipo},"${i.mensaje.replace(/"/g, '""')}"`,
    )
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inconsistencias-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function PanelInformes(): JSX.Element {
  const [observaciones, setObservaciones] =
    useState<ObservacionesFormalesResponse | null>(null);
  const [observacionesError, setObservacionesError] = useState<string | null>(
    null,
  );

  const [inconsistencias, setInconsistencias] =
    useState<ListaInconsistenciasResponse | null>(null);
  const [inconsistenciasError, setInconsistenciasError] = useState<string | null>(
    null,
  );

  const [tipoFiltro, setTipoFiltro] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Fetch observaciones formales (cada vez que tick cambia)
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ObservacionesFormalesResponse>(
        '/api/v1/oficial/inconsistencias/observaciones-formales',
        { validateStatus: () => true },
      )
      .then((resp) => {
        if (cancelled) return;
        if (resp.status === 200) {
          setObservaciones(resp.data);
          setObservacionesError(null);
        } else {
          setObservacionesError(`HTTP ${resp.status}`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setObservacionesError(err instanceof Error ? err.message : 'Error');
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  // Fetch inconsistencias (cada vez que tipoFiltro, limit o tick cambian)
  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string | number> = { limit, page: 1 };
    if (tipoFiltro) params.tipo = tipoFiltro;
    apiClient
      .get<ListaInconsistenciasResponse>('/api/v1/oficial/inconsistencias', {
        params,
        validateStatus: () => true,
      })
      .then((resp) => {
        if (cancelled) return;
        if (resp.status === 200) {
          setInconsistencias(resp.data);
          setInconsistenciasError(null);
        } else {
          setInconsistenciasError(`HTTP ${resp.status}`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setInconsistenciasError(err instanceof Error ? err.message : 'Error');
      });
    return () => {
      cancelled = true;
    };
  }, [tipoFiltro, limit, refreshTick]);

  // Polling
  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((t) => t + 1), POLLING_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-oficial-text">
          Informe de carga
        </h3>
        <button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          className="text-xs px-2 py-1 border border-oficial-border rounded bg-oficial-bg hover:bg-blue-50"
        >
          ⟲ Recargar ahora
        </button>
      </header>

      {/* Sección 1: observaciones formales */}
      <section
        aria-labelledby="obs-formales-titulo"
        className="bg-oficial-card border border-oficial-border rounded-lg p-4"
      >
        <h4
          id="obs-formales-titulo"
          className="text-sm font-semibold text-oficial-text mb-3"
        >
          Resumen por tipo de observación formal{' '}
          {observaciones && (
            <span className="text-oficial-text-secondary font-normal">
              · total {observaciones.total.toLocaleString('es-BO')}
            </span>
          )}
        </h4>
        {observacionesError && (
          <p className="text-sm text-red-700 bg-red-50 px-2 py-1 rounded">
            Error: {observacionesError}
          </p>
        )}
        {observaciones && (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-oficial-text-secondary border-b border-oficial-border">
              <tr>
                <th className="text-left py-2 font-medium">Tipo</th>
                <th className="text-right py-2 font-medium">Cantidad</th>
                <th className="text-left py-2 pl-3 font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {observaciones.conteos_por_tipo.map((c) => (
                <tr
                  key={c.tipo}
                  className="border-b border-oficial-border last:border-b-0"
                >
                  <td className="py-2 font-mono text-xs">{c.tipo}</td>
                  <td className="py-2 text-right font-mono tabular-nums font-semibold">
                    {c.cantidad.toLocaleString('es-BO')}
                  </td>
                  <td className="py-2 pl-3 text-oficial-text-secondary">
                    {c.descripcion_humana}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Sección 2: inconsistencias / actas rechazadas */}
      <section
        aria-labelledby="rechazadas-titulo"
        className="bg-oficial-card border border-oficial-border rounded-lg p-4"
      >
        <h4
          id="rechazadas-titulo"
          className="text-sm font-semibold text-oficial-text mb-3"
        >
          Actas rechazadas{' '}
          {inconsistencias && (
            <span className="text-oficial-text-secondary font-normal">
              · {inconsistencias.total.toLocaleString('es-BO')} total
              {inconsistencias.tipo_mas_comun &&
                ` · más común: ${inconsistencias.tipo_mas_comun}`}
            </span>
          )}
        </h4>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-oficial-text-secondary">Tipo:</span>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="border border-oficial-border rounded px-2 py-1 text-sm bg-white"
            >
              {TIPOS_FILTRABLES.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-oficial-text-secondary">Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-oficial-border rounded px-2 py-1 text-sm bg-white"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {inconsistencias && inconsistencias.items.length > 0 && (
            <button
              type="button"
              onClick={() => exportarCSV(inconsistencias.items)}
              className="ml-auto text-xs px-3 py-1 border border-oficial-border rounded bg-oficial-bg hover:bg-blue-50"
            >
              ⬇ Exportar CSV
            </button>
          )}
        </div>

        {inconsistenciasError && (
          <p className="text-sm text-red-700 bg-red-50 px-2 py-1 rounded mb-2">
            Error: {inconsistenciasError}
          </p>
        )}

        {inconsistencias && inconsistencias.items.length === 0 && (
          <p className="text-sm text-oficial-text-secondary italic py-4 text-center">
            No hay inconsistencias registradas
            {tipoFiltro && ` con tipo ${tipoFiltro}`}.
          </p>
        )}

        {inconsistencias && inconsistencias.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-oficial-text-secondary border-b border-oficial-border">
                <tr>
                  <th className="text-left py-2 font-medium">Fecha</th>
                  <th className="text-left py-2 font-medium">Acta</th>
                  <th className="text-left py-2 font-medium">Mesa</th>
                  <th className="text-left py-2 font-medium">Tipo</th>
                  <th className="text-left py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {inconsistencias.items.map((i, idx) => (
                  <tr
                    key={`${i.id_inconsistencia ?? idx}-${i.codigo_acta}`}
                    className="border-b border-oficial-border last:border-b-0 hover:bg-oficial-bg"
                  >
                    <td className="py-1.5 font-mono tabular-nums whitespace-nowrap">
                      {formatTimestamp(i.timestamp)}
                    </td>
                    <td className="py-1.5 font-mono tabular-nums">
                      {i.codigo_acta}
                    </td>
                    <td className="py-1.5 font-mono tabular-nums">
                      {i.codigo_mesa}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          i.tipo.startsWith('ERROR1')
                            ? 'bg-amber-100 text-amber-800'
                            : i.tipo.startsWith('ERROR2')
                              ? 'bg-orange-100 text-orange-800'
                              : i.tipo.startsWith('ERROR3')
                                ? 'bg-red-100 text-red-800'
                                : i.tipo.startsWith('ERROR4')
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-pink-100 text-pink-800'
                        }`}
                      >
                        {i.tipo}
                      </span>
                    </td>
                    <td className="py-1.5 text-oficial-text-secondary">
                      <span className="line-clamp-2">{i.mensaje}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[10px] text-oficial-text-secondary text-center">
        Actualización automática cada {POLLING_MS / 1000}s.
      </p>
    </div>
  );
}
