import { FORMS_COUNTS, type FormsCount } from './types';

interface ConfigPanelProps {
  formsSimultaneos: FormsCount;
  autoSubmit: boolean;
  delayMs: number;
  isRunning: boolean;
  csvCargando: boolean;
  totalActas: number;
  procesadas: number;
  ok: number;
  error: number;
  pendientes: number;
  onChangeForms: (n: FormsCount) => void;
  onChangeAutoSubmit: (v: boolean) => void;
  onChangeDelay: (ms: number) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onTruncarBD: () => void;
  truncating: boolean;
}

export function ConfigPanel(props: ConfigPanelProps): JSX.Element {
  const {
    formsSimultaneos,
    autoSubmit,
    delayMs,
    isRunning,
    csvCargando,
    totalActas,
    procesadas,
    ok,
    error,
    pendientes,
    onChangeForms,
    onChangeAutoSubmit,
    onChangeDelay,
    onStart,
    onPause,
    onReset,
    onTruncarBD,
    truncating,
  } = props;

  const pct = totalActas > 0 ? (procesadas / totalActas) * 100 : 0;

  return (
    <section
      aria-labelledby="config-panel-titulo"
      className="bg-oficial-card border border-oficial-border rounded-lg p-4 space-y-4"
    >
      <h3
        id="config-panel-titulo"
        className="text-base font-semibold text-oficial-text"
      >
        Configuración de carga
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Forms simultáneos */}
        <div>
          <p className="text-sm font-medium text-oficial-text mb-2">
            Forms simultáneos
          </p>
          <div className="flex gap-2" role="radiogroup">
            {FORMS_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={formsSimultaneos === n}
                onClick={() => onChangeForms(n)}
                className={`flex-1 px-3 py-1.5 text-sm border rounded transition-colors ${
                  formsSimultaneos === n
                    ? 'bg-oficial-blue text-white border-oficial-blue'
                    : 'bg-oficial-bg text-oficial-text border-oficial-border hover:bg-blue-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Delay slider */}
        <div>
          <p className="text-sm font-medium text-oficial-text mb-2">
            Delay antes de submit:{' '}
            <span className="font-mono tabular-nums">
              {(delayMs / 1000).toFixed(1)}s
            </span>
          </p>
          <input
            type="range"
            min={500}
            max={5000}
            step={250}
            value={delayMs}
            onChange={(e) => onChangeDelay(Number(e.target.value))}
            className="w-full"
            aria-label="Delay en milisegundos"
          />
          <div className="flex justify-between text-xs text-oficial-text-secondary mt-1">
            <span>0.5s</span>
            <span>5.0s</span>
          </div>
        </div>
      </div>

      {/* Toggle auto-submit */}
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSubmit}
            onChange={(e) => onChangeAutoSubmit(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-oficial-text">
            Auto-submit
          </span>
        </label>
        <span className="text-xs text-oficial-text-secondary">
          {autoSubmit
            ? 'Los forms se envían automáticamente después del delay.'
            : 'Submit manual: cada form espera tu click.'}
        </span>
      </div>

      {/* Stats */}
      <div className="bg-oficial-bg rounded p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-oficial-text-secondary">
            Procesadas:{' '}
            <span className="font-mono tabular-nums text-oficial-text font-semibold">
              {procesadas.toLocaleString('es-BO')}
            </span>{' '}
            /{' '}
            <span className="font-mono tabular-nums">
              {totalActas.toLocaleString('es-BO')}
            </span>{' '}
            ({pct.toFixed(1)}%)
          </span>
          {csvCargando && (
            <span className="text-xs text-oficial-text-secondary animate-pulse">
              Cargando CSV…
            </span>
          )}
        </div>
        <div className="h-2 bg-oficial-card border border-oficial-border rounded overflow-hidden">
          <div
            className="h-full bg-oficial-green transition-all"
            style={{ width: `${pct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-emerald-700">
            ✓ <span className="font-mono tabular-nums">{ok.toLocaleString('es-BO')}</span> OK
          </span>
          <span className="text-red-700">
            ✗ <span className="font-mono tabular-nums">{error.toLocaleString('es-BO')}</span> errores
          </span>
          <span className="text-blue-700">
            ⏳ <span className="font-mono tabular-nums">{pendientes}</span> en proceso
          </span>
        </div>
      </div>

      {/* Botones */}
      <div className="flex flex-wrap gap-2">
        {!isRunning ? (
          <button
            type="button"
            onClick={onStart}
            disabled={csvCargando || procesadas >= totalActas}
            className="px-4 py-2 bg-oficial-green text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            ▶ Iniciar
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="px-4 py-2 bg-oficial-yellow text-oficial-text rounded hover:opacity-90 text-sm font-medium"
          >
            ⏸ Pausar
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          disabled={isRunning}
          className="px-4 py-2 border border-oficial-border bg-oficial-bg rounded hover:bg-blue-50 disabled:opacity-50 text-sm font-medium"
        >
          ⟲ Reset cursor
        </button>
        <button
          type="button"
          onClick={onTruncarBD}
          disabled={truncating}
          className="px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50 text-sm font-medium ml-auto"
          title="Llama al endpoint admin /reset-actas con confirm=YES_DELETE_ALL"
        >
          {truncating ? 'Limpiando…' : '🗑 Limpiar BD'}
        </button>
      </div>
    </section>
  );
}
