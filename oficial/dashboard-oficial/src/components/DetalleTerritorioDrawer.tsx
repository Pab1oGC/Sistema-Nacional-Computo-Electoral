import { useEffect, useState } from 'react';

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
  contexto: string;
  totalMesas: number;
  actasValidadas: number;
  porcentajeAvance: number;
  ganador: GanadorLike | null;
  resultadosCandidatos: CandidatoLike[];
  totalBlancos?: number;
  totalNulos?: number;
  totalHabilitados?: number;
  drillDownLabel?: string;
}

interface DetalleTerritorioDrawerProps {
  abierto: boolean;
  data: DetalleTerritorioData | null;
  partidosMeta: ReadonlyArray<PartidoMeta>;
  onClose: () => void;
  onDrillDown?: () => void;
}

export function DetalleTerritorioDrawer(
  props: DetalleTerritorioDrawerProps,
): JSX.Element {
  const { abierto, data, partidosMeta, onClose, onDrillDown } = props;

  // Mantener data del último render mientras se cierra (para que el contenido
  // siga visible durante la animación de slide-out).
  const [dataMostrada, setDataMostrada] = useState<DetalleTerritorioData | null>(
    data,
  );
  useEffect(() => {
    if (data) setDataMostrada(data);
  }, [data]);

  useEffect(() => {
    if (!abierto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [abierto, onClose]);

  const partidosByKey = new Map(
    partidosMeta.map((p) => [p.sigla_candidato, p]),
  );

  return (
    <aside
      role="complementary"
      aria-label="Detalle del territorio seleccionado"
      aria-hidden={!abierto}
      className={`absolute top-0 right-0 h-full w-full sm:w-96 lg:w-[400px] bg-oficial-card border-l border-oficial-border shadow-xl transform transition-transform duration-300 ease-out z-[1000] flex flex-col ${
        abierto ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {dataMostrada && (
        <>
          <header className="px-5 py-4 border-b border-oficial-border flex items-start justify-between flex-shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-oficial-text truncate">
                {dataMostrada.nombre}
              </h3>
              <p className="text-xs text-oficial-text-secondary mt-0.5">
                {dataMostrada.contexto}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel"
              className="text-oficial-text-secondary hover:text-oficial-text text-2xl leading-none px-2 -mr-2"
            >
              ×
            </button>
          </header>

          <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
            <section>
              <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-2">
                Avance del cómputo
              </p>
              <div className="flex items-baseline justify-between text-sm mb-1">
                <span>
                  <span className="font-mono tabular-nums font-semibold">
                    {dataMostrada.actasValidadas.toLocaleString('es-BO')}
                  </span>{' '}
                  <span className="text-oficial-text-secondary">
                    de {dataMostrada.totalMesas.toLocaleString('es-BO')} mesas
                  </span>
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  {dataMostrada.porcentajeAvance.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-oficial-bg rounded overflow-hidden">
                <div
                  className="h-full bg-oficial-green transition-all duration-300"
                  style={{ width: `${dataMostrada.porcentajeAvance}%` }}
                  aria-hidden="true"
                />
              </div>
            </section>

            <section>
              <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-2">
                Resultados
              </p>
              {dataMostrada.resultadosCandidatos.length === 0 ||
              dataMostrada.actasValidadas === 0 ? (
                <p className="text-sm text-oficial-text-secondary italic px-2 py-3 bg-oficial-bg rounded text-center">
                  Sin actas procesadas todavía
                </p>
              ) : (
                <div className="space-y-2">
                  {dataMostrada.resultadosCandidatos.map((c) => {
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
                            className="h-full transition-all duration-500"
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

            {(dataMostrada.totalBlancos !== undefined ||
              dataMostrada.totalNulos !== undefined ||
              dataMostrada.totalHabilitados !== undefined) && (
              <section>
                <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-1">
                  Auxiliares
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  {dataMostrada.totalBlancos !== undefined && (
                    <span>
                      <span className="text-oficial-text-secondary">Blancos</span>{' '}
                      <span className="font-mono tabular-nums">
                        {dataMostrada.totalBlancos.toLocaleString('es-BO')}
                      </span>
                    </span>
                  )}
                  {dataMostrada.totalNulos !== undefined && (
                    <span>
                      <span className="text-oficial-text-secondary">Nulos</span>{' '}
                      <span className="font-mono tabular-nums">
                        {dataMostrada.totalNulos.toLocaleString('es-BO')}
                      </span>
                    </span>
                  )}
                  {dataMostrada.totalHabilitados !== undefined && (
                    <span>
                      <span className="text-oficial-text-secondary">
                        Habilitados
                      </span>{' '}
                      <span className="font-mono tabular-nums">
                        {dataMostrada.totalHabilitados.toLocaleString('es-BO')}
                      </span>
                    </span>
                  )}
                </div>
              </section>
            )}

            {dataMostrada.ganador && (
              <p className="text-xs text-oficial-text-secondary border-t border-oficial-border pt-3">
                <span className="font-semibold text-oficial-text">Ganador:</span>{' '}
                {dataMostrada.ganador.nombre_candidato} (
                {dataMostrada.ganador.sigla_partido}) ·{' '}
                {dataMostrada.ganador.porcentaje.toFixed(1)}%
              </p>
            )}
          </div>

          <footer className="px-5 py-3 border-t border-oficial-border flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm border border-oficial-border bg-oficial-bg rounded hover:bg-blue-50"
            >
              Cerrar
            </button>
            {onDrillDown && dataMostrada.drillDownLabel && (
              <button
                type="button"
                onClick={onDrillDown}
                className="px-4 py-1.5 text-sm bg-oficial-blue text-white rounded hover:opacity-90 font-medium"
              >
                {dataMostrada.drillDownLabel} →
              </button>
            )}
          </footer>
        </>
      )}
    </aside>
  );
}
