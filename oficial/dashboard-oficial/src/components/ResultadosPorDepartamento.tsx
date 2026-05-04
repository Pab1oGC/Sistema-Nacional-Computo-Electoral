import { useMemo, useState } from 'react';
import { useResultados } from '../hooks/useResultados';
import { useResultadosPorDepto } from '../hooks/useResultadosPorDepto';
import type { CandidatoResultado, DepartamentoResultados } from '../types/api';
import { formatearNumero } from '../utils/formatearNumero';
import { formatearPorcentaje } from '../utils/formatearPorcentaje';

interface PartidoInfo {
  nombre: string;
  color: string;
}

const PARTIDO_FALLBACK: PartidoInfo = {
  nombre: '',
  color: '#888888',
};

export function ResultadosPorDepartamento() {
  const { data, isLoading, isError } = useResultadosPorDepto();
  const { data: nacional } = useResultados();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Lookup sigla → {nombre, color} desde el resultado nacional. Sirve para
  // mostrar nombre y color de los 4 candidatos en la fila expandida (los
  // 4 candidatos vienen solo con sigla en /resultados/por-departamento).
  const lookupPartido = useMemo(() => {
    const map = new Map<string, PartidoInfo>();
    if (nacional) {
      for (const c of nacional.candidatos as CandidatoResultado[]) {
        map.set(c.sigla_candidato, {
          nombre: c.nombre_candidato,
          color: c.color_hex,
        });
      }
    }
    return map;
  }, [nacional]);

  if (isLoading) {
    return (
      <section aria-labelledby="por-depto-titulo">
        <h2 id="por-depto-titulo" className="text-lg font-semibold mb-4">
          Resultados por departamento
        </h2>
        <div
          className="bg-oficial-card border border-oficial-border rounded-lg overflow-hidden animate-pulse"
          aria-hidden="true"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-12 border-b border-oficial-border last:border-0"
            />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section aria-labelledby="por-depto-titulo">
        <h2 id="por-depto-titulo" className="text-lg font-semibold mb-4">
          Resultados por departamento
        </h2>
        <p className="bg-oficial-card border border-oficial-border rounded-lg p-5 text-oficial-text-secondary">
          No fue posible cargar los datos. Reintentando...
        </p>
      </section>
    );
  }

  if (data.departamentos.length === 0) {
    return (
      <section aria-labelledby="por-depto-titulo">
        <h2 id="por-depto-titulo" className="text-lg font-semibold mb-4">
          Resultados por departamento
        </h2>
        <p className="bg-oficial-card border border-oficial-border rounded-lg p-5 text-oficial-text-secondary">
          Aún no se han recibido actas oficiales.
        </p>
      </section>
    );
  }

  const handleToggle = (id: number): void => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section aria-labelledby="por-depto-titulo">
      <h2 id="por-depto-titulo" className="text-lg font-semibold mb-4">
        Resultados por departamento
      </h2>
      <p className="text-sm text-oficial-text-secondary mb-3">
        Click sobre un departamento para ver el detalle de los 4 candidatos.
      </p>
      <div className="bg-oficial-card border border-oficial-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-oficial-bg border-b border-oficial-border">
            <tr>
              <th scope="col" className="text-left px-4 py-3 font-semibold">
                Departamento
              </th>
              <th scope="col" className="text-left px-4 py-3 font-semibold">
                Primer lugar
              </th>
              <th scope="col" className="text-right px-4 py-3 font-semibold">
                % del depto
              </th>
              <th scope="col" className="text-right px-4 py-3 font-semibold">
                Avance
              </th>
            </tr>
          </thead>
          <tbody>
            {data.departamentos.map((d) => (
              <FilaDepto
                key={d.id_departamento}
                depto={d}
                expanded={expandedId === d.id_departamento}
                onToggle={() => handleToggle(d.id_departamento)}
                lookupPartido={lookupPartido}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface FilaDeptoProps {
  depto: DepartamentoResultados;
  expanded: boolean;
  onToggle: () => void;
  lookupPartido: Map<string, PartidoInfo>;
}

function FilaDepto({
  depto,
  expanded,
  onToggle,
  lookupPartido,
}: FilaDeptoProps) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <>
      <tr
        className="border-b border-oficial-border cursor-pointer hover:bg-oficial-bg focus:bg-oficial-bg outline-none"
        onClick={onToggle}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-controls={`depto-detalle-${depto.id_departamento}`}
      >
        <td className="px-4 py-3 font-medium">
          <span
            className={`inline-block transition-transform mr-2 text-oficial-text-secondary ${
              expanded ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
          {depto.nombre_departamento}
        </td>
        <td className="px-4 py-3">
          {depto.ganador ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="w-6 h-6 rounded text-white text-xs flex items-center justify-center font-bold"
                style={{ backgroundColor: depto.ganador.color_hex }}
                aria-hidden="true"
              >
                {depto.ganador.sigla_candidato}
              </span>
              <span>{depto.ganador.nombre_candidato}</span>
              <span className="text-xs text-oficial-text-secondary">
                ({depto.ganador.sigla_partido})
              </span>
            </div>
          ) : (
            <span className="text-oficial-text-secondary italic">
              Esperando reporte
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {depto.ganador ? formatearPorcentaje(depto.ganador.porcentaje) : '—'}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <span>{formatearPorcentaje(depto.porcentaje_avance_depto)}</span>
            <span className="text-xs text-oficial-text-secondary">
              ({formatearNumero(depto.actas_validadas_depto)}/
              {formatearNumero(depto.total_mesas_depto)})
            </span>
          </div>
        </td>
      </tr>
      <tr
        id={`depto-detalle-${depto.id_departamento}`}
        aria-hidden={!expanded}
      >
        <td colSpan={4} className="p-0">
          <div
            style={{
              maxHeight: expanded ? '600px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease-out',
            }}
          >
            <div className="p-4 bg-oficial-bg border-b border-oficial-border space-y-2">
              <p className="text-xs uppercase tracking-wide text-oficial-text-secondary mb-3">
                Detalle por candidato en {depto.nombre_departamento}
              </p>
              {depto.resultados_candidatos.map((c) => {
                const info =
                  lookupPartido.get(c.sigla_candidato) ?? PARTIDO_FALLBACK;
                return (
                  <div
                    key={c.sigla_candidato}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="w-7 h-7 rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                      style={{ backgroundColor: info.color }}
                      aria-hidden="true"
                    >
                      {c.sigla_candidato}
                    </span>
                    <span className="w-40 truncate text-sm">
                      {info.nombre || c.sigla_candidato}
                    </span>
                    <div
                      className="flex-1 h-3 bg-oficial-border rounded overflow-hidden min-w-[60px]"
                      role="progressbar"
                      aria-valuenow={Math.round(c.porcentaje)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${Math.min(c.porcentaje, 100)}%`,
                          backgroundColor: info.color,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right tabular-nums text-sm font-semibold">
                      {formatearPorcentaje(c.porcentaje)}
                    </span>
                    <span className="w-24 text-right text-oficial-text-secondary tabular-nums text-xs">
                      {formatearNumero(c.votos)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
