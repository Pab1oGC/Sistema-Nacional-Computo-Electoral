import { formatearNumero } from '../../utils/formatearNumero';
import { formatearPorcentaje } from '../../utils/formatearPorcentaje';

/**
 * Forma esperada de cada item del payload (cuando viene de las gráficas
 * Barras-nacionales o Dona-por-depto). El payload de Recharts pasa el
 * objeto original del data array bajo `payload[0].payload`.
 */
interface CandidatoLikePayload {
  sigla_candidato?: string;
  nombre_candidato?: string;
  sigla_partido?: string;
  votos_total?: number;
  votos?: number;
  porcentaje?: number;
}

/**
 * Recharts 3 cambió la forma del prop type del content. Definimos un
 * shape estructural mínimo que matchea lo que recibimos en runtime,
 * independiente de la versión exacta de Recharts.
 */
interface RechartsTooltipRenderProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    name?: string | number;
    color?: string;
    dataKey?: string | number;
    payload?: unknown;
  }>;
  label?: string | number;
}

export function TooltipPersonalizado(
  props: RechartsTooltipRenderProps,
): JSX.Element | null {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const data = (item.payload ?? {}) as CandidatoLikePayload;

  const titulo = data.nombre_candidato ?? data.sigla_candidato ?? '';
  const subtitulo = data.sigla_partido ?? '';
  const votos = data.votos_total ?? data.votos ?? 0;
  const porcentaje = typeof data.porcentaje === 'number' ? data.porcentaje : 0;

  return (
    <div className="bg-white border border-oficial-border rounded-lg shadow-md p-3 min-w-[200px]">
      <p className="font-semibold text-oficial-text">{titulo}</p>
      {subtitulo && (
        <p className="text-xs text-oficial-text-secondary mb-2">{subtitulo}</p>
      )}
      <p className="text-sm">
        <span className="text-oficial-text-secondary">Votos: </span>
        <span className="tabular-nums text-oficial-text font-medium">
          {formatearNumero(votos)}
        </span>
      </p>
      <p className="text-sm">
        <span className="text-oficial-text-secondary">Porcentaje: </span>
        <span className="tabular-nums text-oficial-text font-medium">
          {formatearPorcentaje(porcentaje)}
        </span>
      </p>
    </div>
  );
}
