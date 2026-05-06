import { useEffect, useState } from 'react';
import { PARTIDOS, type ActiveForm } from './types';

interface ActaFormProps {
  form: ActiveForm;
  delayMs: number;
  autoSubmit: boolean;
  compact: boolean;
  onSubmitManual: (id: string) => void;
}

const ESTILO_BORDE: Record<ActiveForm['estado'], string> = {
  llenando: 'border-blue-400',
  esperando_submit: 'border-amber-400',
  enviando: 'border-orange-500',
  reintentando: 'border-orange-400 animate-pulse',
  ok: 'border-emerald-500 bg-emerald-50',
  error: 'border-red-500 bg-red-50',
};

const BADGE_ESTADO: Record<
  ActiveForm['estado'],
  { texto: string; clases: string }
> = {
  llenando: {
    texto: '🖋 Transcribiendo',
    clases: 'bg-blue-100 text-blue-800',
  },
  esperando_submit: {
    texto: '⏸ Pendiente',
    clases: 'bg-amber-100 text-amber-800',
  },
  enviando: {
    texto: '⏳ Enviando',
    clases: 'bg-orange-100 text-orange-800',
  },
  reintentando: {
    texto: '🔁 Reintentando',
    clases: 'bg-orange-100 text-orange-800',
  },
  ok: { texto: '✓ Registrada', clases: 'bg-emerald-100 text-emerald-800' },
  error: { texto: '✗ Rechazada', clases: 'bg-red-100 text-red-800' },
};

function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.min((num / denom) * 100, 100);
}

export function ActaForm(props: ActaFormProps): JSX.Element {
  const { form, delayMs, autoSubmit, compact, onSubmitManual } = props;
  const { acta } = form;

  const [progressPct, setProgressPct] = useState<number>(0);

  useEffect(() => {
    if (form.estado !== 'llenando' || !autoSubmit) {
      setProgressPct(0);
      return;
    }
    const start = Date.now();
    const intervalId = window.setInterval(() => {
      const p = Math.min(((Date.now() - start) / delayMs) * 100, 100);
      setProgressPct(p);
      if (p >= 100) window.clearInterval(intervalId);
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [form.estado, autoSubmit, delayMs]);

  const totalValidos =
    acta.votos_p1 + acta.votos_p2 + acta.votos_p3 + acta.votos_p4;

  const puedeSubmitManual =
    !autoSubmit &&
    (form.estado === 'llenando' || form.estado === 'esperando_submit');

  const badge = BADGE_ESTADO[form.estado];

  if (compact) {
    return (
      <div
        className={`bg-oficial-card border-2 ${ESTILO_BORDE[form.estado]} rounded-lg p-2 transition-colors`}
      >
        <header className="flex items-start justify-between gap-1 mb-1">
          <p className="text-[11px] font-mono tabular-nums truncate">
            …{String(acta.codigo_acta).slice(-6)}
          </p>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${badge.clases}`}
          >
            {badge.texto.split(' ')[0]}
          </span>
        </header>
        <p className="text-[10px] text-oficial-text-secondary mb-1">
          Mesa #{acta.codigo_mesa.toString().slice(-3)}
        </p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums leading-tight">
          {PARTIDOS.map((p) => (
            <span key={p.sigla_candidato}>
              <span style={{ color: p.color_hex }} className="font-semibold">
                {p.sigla_candidato}
              </span>
              :{acta[p.votosKey]}
            </span>
          ))}
          <span>
            <span className="text-oficial-text-secondary">Bl</span>:{acta.blancos}
          </span>
          <span>
            <span className="text-oficial-text-secondary">Nu</span>:{acta.nulos}
          </span>
          <span>
            <span className="text-oficial-text-secondary">Hab</span>:{acta.habilitados}
          </span>
          <span>
            <span className="text-oficial-text-secondary">Anf</span>:{acta.anfora}
          </span>
        </div>
        {acta.tipo_observacion_formal && (
          <p className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded mt-1 truncate">
            ⚠ {acta.tipo_observacion_formal}
          </p>
        )}
        {form.estado === 'error' && form.mensaje && (
          <p className="text-[9px] text-red-700 px-1 mt-1 line-clamp-1">
            {form.mensaje}
          </p>
        )}
        {form.estado === 'llenando' && autoSubmit && (
          <div className="h-0.5 bg-oficial-bg rounded overflow-hidden mt-1">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressPct}%` }}
              aria-hidden="true"
            />
          </div>
        )}
        {puedeSubmitManual && (
          <button
            type="button"
            onClick={() => onSubmitManual(form.id)}
            className="w-full mt-1 text-[10px] px-1 py-0.5 bg-oficial-blue text-white rounded hover:opacity-90"
          >
            Enviar
          </button>
        )}
      </div>
    );
  }

  // Versión normal (1, 4, 9 forms)
  return (
    <div
      className={`bg-oficial-card border-2 ${ESTILO_BORDE[form.estado]} rounded-lg p-4 transition-colors space-y-3`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-oficial-text-secondary">Acta</p>
          <p className="text-sm font-mono tabular-nums truncate font-semibold text-oficial-text">
            {acta.codigo_acta}
          </p>
          <p className="text-xs text-oficial-text-secondary mt-0.5">
            Mesa #{acta.codigo_mesa}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${badge.clases}`}
        >
          {badge.texto}
          {form.estado === 'reintentando' && form.retryAttempt && (
            <span className="ml-1 opacity-75">
              ({form.retryAttempt}/5)
            </span>
          )}
        </span>
      </header>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-2">
          Resultados
        </p>
        {totalValidos === 0 ? (
          <p className="text-xs text-oficial-text-secondary italic px-2 py-3 bg-oficial-bg rounded text-center">
            Sin votos válidos
          </p>
        ) : (
          <div className="space-y-1.5">
            {PARTIDOS.map((p) => {
              const votos = acta[p.votosKey];
              const porcentaje = pct(votos, totalValidos);
              return (
                <div key={p.sigla_candidato}>
                  <div className="flex items-baseline justify-between text-xs mb-0.5">
                    <span className="font-medium">
                      <span style={{ color: p.color_hex }}>
                        {p.sigla_partido}
                      </span>{' '}
                      <span className="text-oficial-text-secondary">
                        ({p.sigla_candidato})
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {votos} ·{' '}
                      <span className="text-oficial-text-secondary">
                        {porcentaje.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-oficial-bg rounded overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${porcentaje}%`,
                        backgroundColor: p.color_hex,
                      }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-oficial-text-secondary font-semibold mb-1">
          Auxiliares
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <span>
            <span className="text-oficial-text-secondary">Blancos</span>{' '}
            <span className="font-mono tabular-nums">{acta.blancos}</span>
          </span>
          <span>
            <span className="text-oficial-text-secondary">Nulos</span>{' '}
            <span className="font-mono tabular-nums">{acta.nulos}</span>
          </span>
          <span>
            <span className="text-oficial-text-secondary">Hab.</span>{' '}
            <span className="font-mono tabular-nums">{acta.habilitados}</span>
          </span>
          <span>
            <span className="text-oficial-text-secondary">Ánfora</span>{' '}
            <span className="font-mono tabular-nums">{acta.anfora}</span>
          </span>
          <span>
            <span className="text-oficial-text-secondary">No usadas</span>{' '}
            <span className="font-mono tabular-nums">{acta.no_usadas}</span>
          </span>
        </div>
      </div>

      {acta.tipo_observacion_formal && (
        <div className="border-l-4 border-amber-400 bg-amber-50 px-2 py-1.5 rounded">
          <p className="text-[10px] font-semibold text-amber-900 uppercase tracking-wide">
            ⚠ {acta.tipo_observacion_formal}
          </p>
          {acta.observacion_formal && (
            <p className="text-[11px] text-amber-800 mt-0.5 line-clamp-2">
              {acta.observacion_formal}
            </p>
          )}
        </div>
      )}

      {form.estado === 'error' && form.mensaje && (
        <p className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded line-clamp-2">
          {form.mensaje}
        </p>
      )}

      {form.estado === 'llenando' && autoSubmit && (
        <div className="h-1 bg-oficial-bg rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
        </div>
      )}

      {puedeSubmitManual && (
        <button
          type="button"
          onClick={() => onSubmitManual(form.id)}
          className="w-full text-sm px-3 py-1.5 bg-oficial-blue text-white rounded hover:opacity-90 font-medium"
        >
          Enviar
        </button>
      )}
    </div>
  );
}
