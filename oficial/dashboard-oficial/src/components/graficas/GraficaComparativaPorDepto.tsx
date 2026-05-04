import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useResultados } from '../../hooks/useResultados';
import { useResultadosPorDepto } from '../../hooks/useResultadosPorDepto';
import { formatearPorcentaje } from '../../utils/formatearPorcentaje';

const COLOR_BORDER = '#E1E5EB';
const COLOR_TEXT_PRIMARY = '#1A2332';
const COLOR_TEXT_SECONDARY = '#5A6478';
const COLOR_FALLBACK = '#888888';

interface PartidoMeta {
  sigla: string;
  primer_nombre: string;
  partido: string;
  color: string;
}

interface DataRow {
  nombre: string;
  P1: number;
  P2: number;
  P3: number;
  P4: number;
}

const SIGLAS = ['P1', 'P2', 'P3', 'P4'] as const;
type Sigla = (typeof SIGLAS)[number];

export function GraficaComparativaPorDepto(): JSX.Element {
  const { data: deptos, isLoading } = useResultadosPorDepto();
  const { data: nacional } = useResultados();

  const partidos = useMemo<Record<Sigla, PartidoMeta>>(() => {
    const fallback = (sigla: Sigla): PartidoMeta => ({
      sigla,
      primer_nombre: sigla,
      partido: '',
      color: COLOR_FALLBACK,
    });
    const result: Record<Sigla, PartidoMeta> = {
      P1: fallback('P1'),
      P2: fallback('P2'),
      P3: fallback('P3'),
      P4: fallback('P4'),
    };
    if (nacional) {
      for (const c of nacional.candidatos) {
        const sigla = c.sigla_candidato as Sigla;
        if (sigla in result) {
          result[sigla] = {
            sigla,
            primer_nombre: c.nombre_candidato.split(' ')[0],
            partido: c.sigla_partido,
            color: c.color_hex,
          };
        }
      }
    }
    return result;
  }, [nacional]);

  const data = useMemo<DataRow[]>(() => {
    if (!deptos) return [];
    return deptos.departamentos.map((d) => {
      const row: DataRow = {
        nombre: d.nombre_departamento,
        P1: 0,
        P2: 0,
        P3: 0,
        P4: 0,
      };
      for (const c of d.resultados_candidatos) {
        const sigla = c.sigla_candidato as Sigla;
        if (sigla in row) {
          row[sigla] = c.porcentaje;
        }
      }
      return row;
    });
  }, [deptos]);

  if (isLoading) {
    return (
      <div
        className="h-[500px] bg-oficial-bg rounded animate-pulse"
        aria-hidden="true"
      />
    );
  }

  if (!deptos || data.length === 0) {
    return (
      <p className="text-oficial-text-secondary text-center py-12">
        Aún no se han recibido actas oficiales.
      </p>
    );
  }

  const labelDe = (sigla: Sigla): string => {
    const p = partidos[sigla];
    return p.partido
      ? `${p.primer_nombre} (${p.partido})`
      : p.primer_nombre;
  };

  return (
    <ResponsiveContainer width="100%" height={500}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLOR_BORDER} />
        <XAxis
          dataKey="nombre"
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
          tick={{ fontSize: 11, fill: COLOR_TEXT_PRIMARY }}
        />
        <YAxis
          tickFormatter={(v: number): string => `${v}%`}
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: COLOR_TEXT_SECONDARY }}
        />
        <Tooltip content={<TooltipComparativa />} cursor={{ fill: '#F4F6F9' }} />
        <Legend />
        <Bar dataKey="P1" fill={partidos.P1.color} name={labelDe('P1')} />
        <Bar dataKey="P2" fill={partidos.P2.color} name={labelDe('P2')} />
        <Bar dataKey="P3" fill={partidos.P3.color} name={labelDe('P3')} />
        <Bar dataKey="P4" fill={partidos.P4.color} name={labelDe('P4')} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TooltipComparativaProps {
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

function TooltipComparativa(
  props: TooltipComparativaProps,
): JSX.Element | null {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-oficial-border rounded-lg shadow-md p-3 min-w-[220px]">
      <p className="font-semibold text-oficial-text mb-2">{String(label ?? '')}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div
            key={i}
            className="flex justify-between items-center gap-3 text-sm"
          >
            <span
              className="font-medium"
              style={{ color: p.color ?? COLOR_TEXT_PRIMARY }}
            >
              {String(p.name ?? '')}
            </span>
            <span className="tabular-nums text-oficial-text">
              {typeof p.value === 'number' ? formatearPorcentaje(p.value) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
