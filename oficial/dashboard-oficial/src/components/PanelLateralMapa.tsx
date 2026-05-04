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

export interface DetalleData {
  nombre: string;
  contexto: string;
  totalMesas: number;
  actasValidadas: number;
  porcentajeAvance: number;
  ganador: GanadorLike | null;
  resultadosCandidatos: CandidatoLike[];
  drillDownLabel?: string;
}

export interface ItemListaTerritorio {
  id: string;
  nombre: string;
  ganador: GanadorLike | null;
  porcentajeAvance: number;
  actasValidadas: number;
  totalMesas: number;
}

interface PanelLateralMapaProps {
  nivelLabel: string;
  contextoLabel: string;
  itemsLista: ItemListaTerritorio[];
  detalle: DetalleData | null;
  partidosMeta: ReadonlyArray<PartidoMeta>;
  onSelectItem: (id: string) => void;
  onCerrarDetalle: () => void;
  onDrillDown?: () => void;
}

export function PanelLateralMapa(props: PanelLateralMapaProps): JSX.Element {
  const {
    nivelLabel,
    contextoLabel,
    itemsLista,
    detalle,
    partidosMeta,
    onSelectItem,
    onCerrarDetalle,
    onDrillDown,
  } = props;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detalle) onCerrarDetalle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [detalle, onCerrarDetalle]);

  return (
    <aside
      role="complementary"
      aria-label="Panel del mapa"
      className="bg-oficial-card border-l border-oficial-border w-full sm:w-72 lg:w-[280px] flex flex-col flex-shrink-0"
      style={{ height: '680px' }}
    >
      {detalle ? (
        <DetalleView
          detalle={detalle}
          partidosMeta={partidosMeta}
          onCerrar={onCerrarDetalle}
          onDrillDown={onDrillDown}
        />
      ) : (
        <ListaView
          nivelLabel={nivelLabel}
          contextoLabel={contextoLabel}
          items={itemsLista}
          onSelect={onSelectItem}
        />
      )}
    </aside>
  );
}

function ListaView({
  nivelLabel,
  contextoLabel,
  items,
  onSelect,
}: {
  nivelLabel: string;
  contextoLabel: string;
  items: ItemListaTerritorio[];
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <>
      <header className="px-4 py-3 border-b border-oficial-border flex-shrink-0">
        <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold">
          {contextoLabel}
        </p>
        <h3 className="text-base font-semibold text-oficial-text mt-0.5">
          {nivelLabel}
        </h3>
        <p className="text-xs text-oficial-text-secondary mt-1">
          Click en un territorio (lista o mapa) para ver el detalle.
        </p>
      </header>
      <ul className="flex-1 overflow-y-auto divide-y divide-oficial-border">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-oficial-text-secondary text-center italic">
            Sin territorios para mostrar.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="w-full text-left px-4 py-2.5 hover:bg-oficial-bg transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-medium text-sm text-oficial-text truncate">
                    {item.nombre}
                  </span>
                  {item.ganador && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded text-white font-mono whitespace-nowrap"
                      style={{ backgroundColor: item.ganador.color_hex }}
                    >
                      {item.ganador.sigla_partido}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between text-xs text-oficial-text-secondary gap-2">
                  <span>
                    {item.ganador ? (
                      <span className="tabular-nums">
                        {item.ganador.porcentaje.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="italic">sin actas</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {item.actasValidadas.toLocaleString('es-BO')}/
                    {item.totalMesas.toLocaleString('es-BO')} (
                    {item.porcentajeAvance.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1 bg-oficial-bg rounded mt-1 overflow-hidden">
                  <div
                    className="h-full bg-oficial-green transition-all duration-300"
                    style={{ width: `${item.porcentajeAvance}%` }}
                    aria-hidden="true"
                  />
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  );
}

function DetalleView({
  detalle,
  partidosMeta,
  onCerrar,
  onDrillDown,
}: {
  detalle: DetalleData;
  partidosMeta: ReadonlyArray<PartidoMeta>;
  onCerrar: () => void;
  onDrillDown?: () => void;
}): JSX.Element {
  const partidosByKey = new Map(
    partidosMeta.map((p) => [p.sigla_candidato, p]),
  );

  return (
    <>
      <header className="px-4 py-3 border-b border-oficial-border flex items-start justify-between flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold">
            {detalle.contexto}
          </p>
          <h3 className="text-base font-semibold text-oficial-text mt-0.5 truncate">
            {detalle.nombre}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Volver a la lista"
          title="Volver a la lista (ESC)"
          className="text-oficial-text-secondary hover:text-oficial-text text-xl leading-none px-1 -mr-1"
        >
          ×
        </button>
      </header>

      <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
        <section>
          <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-1">
            Avance del cómputo
          </p>
          <div className="flex items-baseline justify-between text-sm mb-1">
            <span>
              <span className="font-mono tabular-nums font-semibold">
                {detalle.actasValidadas.toLocaleString('es-BO')}
              </span>{' '}
              <span className="text-oficial-text-secondary text-xs">
                de {detalle.totalMesas.toLocaleString('es-BO')}
              </span>
            </span>
            <span className="font-mono tabular-nums font-semibold">
              {detalle.porcentajeAvance.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-oficial-bg rounded overflow-hidden">
            <div
              className="h-full bg-oficial-green transition-all duration-300"
              style={{ width: `${detalle.porcentajeAvance}%` }}
              aria-hidden="true"
            />
          </div>
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-2">
            Resultados
          </p>
          {detalle.resultadosCandidatos.length === 0 ||
          detalle.actasValidadas === 0 ? (
            <p className="text-xs text-oficial-text-secondary italic px-2 py-2 bg-oficial-bg rounded text-center">
              Sin actas procesadas todavía
            </p>
          ) : (
            <div className="space-y-2">
              {detalle.resultadosCandidatos.map((c) => {
                const meta = partidosByKey.get(c.sigla_candidato);
                const color = meta?.color_hex ?? '#888';
                return (
                  <div key={c.sigla_candidato}>
                    <div className="flex items-baseline justify-between text-xs mb-0.5">
                      <span className="font-medium">
                        <span style={{ color }}>
                          {meta?.sigla_partido ?? c.sigla_candidato}
                        </span>{' '}
                        <span className="text-oficial-text-secondary">
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
                    <div className="h-2 bg-oficial-bg rounded overflow-hidden">
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

        {detalle.ganador && (
          <p className="text-xs text-oficial-text-secondary border-t border-oficial-border pt-3">
            <span className="font-semibold text-oficial-text">Ganador:</span>{' '}
            {detalle.ganador.nombre_candidato}
            <br />
            <span className="text-[11px]">
              {detalle.ganador.sigla_partido} ·{' '}
              {detalle.ganador.porcentaje.toFixed(1)}%
            </span>
          </p>
        )}
      </div>

      <footer className="px-4 py-2 border-t border-oficial-border flex justify-between gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onCerrar}
          className="px-3 py-1 text-xs border border-oficial-border bg-oficial-bg rounded hover:bg-blue-50"
        >
          ← Lista
        </button>
        {onDrillDown && detalle.drillDownLabel && (
          <button
            type="button"
            onClick={onDrillDown}
            className="px-3 py-1 text-xs bg-oficial-blue text-white rounded hover:opacity-90 font-medium"
          >
            {detalle.drillDownLabel} →
          </button>
        )}
      </footer>
    </>
  );
}
