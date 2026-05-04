import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useResultados } from '../../hooks/useResultados';
import { formatearNumero } from '../../utils/formatearNumero';
import { TooltipPersonalizado } from './TooltipPersonalizado';

const COLOR_BORDER = '#E1E5EB';
const COLOR_TEXT_PRIMARY = '#1A2332';
const COLOR_TEXT_SECONDARY = '#5A6478';

export function GraficaBarrasVerticales(): JSX.Element {
  const { data, isLoading, isError } = useResultados();

  if (isLoading) {
    return (
      <div
        className="h-[400px] bg-oficial-bg rounded animate-pulse"
        aria-hidden="true"
      />
    );
  }

  if (isError || !data) {
    return (
      <p className="text-oficial-text-secondary text-center py-12">
        No fue posible cargar los datos. Reintentando...
      </p>
    );
  }

  if (data.candidatos.length === 0 || data.total_votos_validos === 0) {
    return (
      <p className="text-oficial-text-secondary text-center py-12">
        Aún no se han recibido actas oficiales.
      </p>
    );
  }

  const candidatos = [...data.candidatos].sort(
    (a, b) => a.orden_papeleta - b.orden_papeleta,
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={candidatos}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR_BORDER} />
          <XAxis
            dataKey="sigla_candidato"
            tick={{ fontSize: 14, fill: COLOR_TEXT_PRIMARY }}
          />
          <YAxis
            tickFormatter={(v: number): string => `${v}%`}
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: COLOR_TEXT_SECONDARY }}
          />
          <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: '#F4F6F9' }} />
          <Bar dataKey="porcentaje" radius={[8, 8, 0, 0]}>
            {candidatos.map((c) => (
              <Cell key={c.sigla_candidato} fill={c.color_hex} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-sm text-oficial-text-secondary text-center mt-3">
        Total de votos válidos:{' '}
        <span className="font-semibold text-oficial-text tabular-nums">
          {formatearNumero(data.total_votos_validos)}
        </span>
      </p>
    </div>
  );
}
