import { useMemo, useState } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useResultados } from '../../hooks/useResultados';
import { useResultadosPorDepto } from '../../hooks/useResultadosPorDepto';
import { formatearNumero } from '../../utils/formatearNumero';
import { TooltipPersonalizado } from './TooltipPersonalizado';

interface DataPie {
  sigla_candidato: string;
  nombre_candidato: string;
  votos: number;
  porcentaje: number;
  color_hex: string;
}

export function GraficaDonaPorDepartamento(): JSX.Element {
  const { data: deptos, isLoading } = useResultadosPorDepto();
  const { data: nacional } = useResultados();
  const [deptoSeleccionado, setDeptoSeleccionado] = useState<number | null>(null);

  // Lookup sigla → {nombre, color} desde el resultado nacional. Sirve para
  // colorear y rotular la dona aunque el endpoint por-depto solo trae sigla.
  const lookupPartido = useMemo(() => {
    const map = new Map<string, { nombre: string; color: string }>();
    if (nacional) {
      for (const c of nacional.candidatos) {
        map.set(c.sigla_candidato, {
          nombre: c.nombre_candidato,
          color: c.color_hex,
        });
      }
    }
    return map;
  }, [nacional]);

  const deptoActual = useMemo(() => {
    if (!deptos || deptos.departamentos.length === 0) return null;
    if (deptoSeleccionado != null) {
      return (
        deptos.departamentos.find(
          (d) => d.id_departamento === deptoSeleccionado,
        ) ?? null
      );
    }
    // Default: depto con más mesas
    return [...deptos.departamentos].sort(
      (a, b) => b.total_mesas_depto - a.total_mesas_depto,
    )[0];
  }, [deptos, deptoSeleccionado]);

  if (isLoading) {
    return (
      <div
        className="h-[450px] bg-oficial-bg rounded animate-pulse"
        aria-hidden="true"
      />
    );
  }

  if (!deptos || !deptoActual) {
    return (
      <p className="text-oficial-text-secondary text-center py-12">
        No fue posible cargar los datos. Reintentando...
      </p>
    );
  }

  const dataPie: DataPie[] = deptoActual.resultados_candidatos.map((c) => {
    const info = lookupPartido.get(c.sigla_candidato);
    return {
      sigla_candidato: c.sigla_candidato,
      nombre_candidato: info?.nombre ?? c.sigla_candidato,
      votos: c.votos,
      porcentaje: c.porcentaje,
      color_hex: info?.color ?? '#888888',
    };
  });

  const totalVotos = deptoActual.resultados_candidatos.reduce(
    (sum, c) => sum + c.votos,
    0,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label
          htmlFor="depto-select"
          className="text-sm font-medium text-oficial-text"
        >
          Departamento:
        </label>
        <select
          id="depto-select"
          value={deptoActual.id_departamento}
          onChange={(e) => setDeptoSeleccionado(Number(e.target.value))}
          className="border border-oficial-border rounded px-3 py-1.5 text-sm bg-white text-oficial-text"
        >
          {deptos.departamentos.map((d) => (
            <option key={d.id_departamento} value={d.id_departamento}>
              {d.nombre_departamento}
            </option>
          ))}
        </select>
      </div>
      {totalVotos === 0 ? (
        <p className="text-oficial-text-secondary text-center py-12">
          Aún no se han recibido actas en {deptoActual.nombre_departamento}.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={dataPie}
                dataKey="porcentaje"
                nameKey="sigla_candidato"
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={140}
                paddingAngle={2}
                label={renderLabel}
              >
                {dataPie.map((c) => (
                  <Cell key={c.sigla_candidato} fill={c.color_hex} />
                ))}
              </Pie>
              <Tooltip content={<TooltipPersonalizado />} />
              <Legend verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-sm text-oficial-text-secondary text-center mt-2">
            Mostrando{' '}
            <span className="font-semibold text-oficial-text tabular-nums">
              {formatearNumero(totalVotos)}
            </span>{' '}
            votos en {deptoActual.nombre_departamento}
          </p>
        </>
      )}
    </div>
  );
}

function renderLabel(props: unknown): string {
  if (typeof props === 'object' && props !== null && 'porcentaje' in props) {
    const p = (props as { porcentaje: unknown }).porcentaje;
    if (typeof p === 'number') {
      return `${p.toFixed(1)}%`;
    }
  }
  return '';
}
