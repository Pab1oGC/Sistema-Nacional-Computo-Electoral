import { useEffect } from 'react';

interface CandidatoLike {
  sigla_candidato: string;
  votos: number;
  porcentaje: number;
}

interface GanadorLike {
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
  votos: number;
  porcentaje: number;
}

interface PartidoMeta {
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
}

export interface DetalleTerritorioData {
  nombre: string;
  contexto: string;            // ej: "Provincia · La Paz"
  totalMesas: number;
  actasValidadas: number;
  porcentajeAvance: number;
  ganador: GanadorLike | null;
  resultadosCandidatos: CandidatoLike[];
  totalBlancos?: number;
  totalNulos?: number;
  totalHabilitados?: number;
  drillDownLabel?: string;     // ej: "Ver provincias", null si no hay drill
}

interface DetalleTerritorioModalProps {
  data: DetalleTerritorioData;
  partidosMeta: ReadonlyArray<PartidoMeta>;
  onClose: () => void;
  onDrillDown?: () => void;
}

export function DetalleTerritorioModal(
  props: DetalleTerritorioModalProps,
): JSX.Element {
  const { data, partidosMeta, onClose, onDrillDown } = props;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const partidosByKey = new Map(
    partidosMeta.map((p) => [p.sigla_candidato, p]),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalle-territorio-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-oficial-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-oficial-border flex items-start justify-between">
          <div>
            <h3
              id="detalle-territorio-titulo"
              className="text-lg font-semibold text-oficial-text"
            >
              {data.nombre}
            </h3>
            <p className="text-xs text-oficial-text-secondary mt-0.5">
              {data.contexto}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-oficial-text-secondary hover:text-oficial-text text-xl leading-none px-2"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {/* Avance */}
          <section>
            <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-2">
              Avance del cómputo
            </p>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span>
                <span className="font-mono tabular-nums font-semibold">
                  {data.actasValidadas.toLocaleString('es-BO')}
                </span>{' '}
                <span className="text-oficial-text-secondary">
                  de {data.totalMesas.toLocaleString('es-BO')} mesas
                </span>
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {data.porcentajeAvance.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-oficial-bg rounded overflow-hidden">
              <div
                className="h-full bg-oficial-green transition-all"
                style={{ width: `${data.porcentajeAvance}%` }}
                aria-hidden="true"
              />
            </div>
          </section>

          {/* Resultados */}
          <section>
            <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-2">
              Resultados
            </p>
            {data.resultadosCandidatos.length === 0 ||
            data.actasValidadas === 0 ? (
              <p className="text-sm text-oficial-text-secondary italic px-2 py-3 bg-oficial-bg rounded text-center">
                Sin actas procesadas todavía
              </p>
            ) : (
              <div className="space-y-2">
                {data.resultadosCandidatos.map((c) => {
                  const meta = partidosByKey.get(c.sigla_candidato);
                  const color = meta?.color_hex ?? '#888';
                  return (
                    <div key={c.sigla_candidato}>
                      <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="font-medium">
                          <span style={{ color }}>
                            {meta?.sigla_partido ?? c.sigla_candidato}
                          </span>{' '}
                          <span className="text-oficial-text-secondary text-xs">
                            ({c.sigla_candidato})
                          </span>
                        </span>
                        <span className="font-mono tabular-nums">
                          {c.votos.toLocaleString('es-BO')} ·{' '}
                          <span className="text-oficial-text-secondary">
                            {c.porcentaje.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-oficial-bg rounded overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${c.porcentaje}%`,
                            backgroundColor: color,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Auxiliares (opcionales) */}
          {(data.totalBlancos !== undefined ||
            data.totalNulos !== undefined ||
            data.totalHabilitados !== undefined) && (
            <section>
              <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-1">
                Auxiliares
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                {data.totalBlancos !== undefined && (
                  <span>
                    <span className="text-oficial-text-secondary">Blancos</span>{' '}
                    <span className="font-mono tabular-nums">
                      {data.totalBlancos.toLocaleString('es-BO')}
                    </span>
                  </span>
                )}
                {data.totalNulos !== undefined && (
                  <span>
                    <span className="text-oficial-text-secondary">Nulos</span>{' '}
                    <span className="font-mono tabular-nums">
                      {data.totalNulos.toLocaleString('es-BO')}
                    </span>
                  </span>
                )}
                {data.totalHabilitados !== undefined && (
                  <span>
                    <span className="text-oficial-text-secondary">Habilitados</span>{' '}
                    <span className="font-mono tabular-nums">
                      {data.totalHabilitados.toLocaleString('es-BO')}
                    </span>
                  </span>
                )}
              </div>
            </section>
          )}

          {data.ganador && (
            <p className="text-xs text-oficial-text-secondary">
              <span className="font-semibold text-oficial-text">Ganador:</span>{' '}
              {data.ganador.nombre_candidato} ({data.ganador.sigla_partido}) ·{' '}
              {data.ganador.porcentaje.toFixed(1)}%
            </p>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-oficial-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-oficial-border bg-oficial-bg rounded hover:bg-blue-50"
          >
            Cerrar
          </button>
          {onDrillDown && data.drillDownLabel && (
            <button
              type="button"
              onClick={onDrillDown}
              className="px-4 py-1.5 text-sm bg-oficial-blue text-white rounded hover:opacity-90 font-medium"
            >
              {data.drillDownLabel} →
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
