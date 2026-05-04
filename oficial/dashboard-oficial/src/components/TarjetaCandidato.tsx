import type { CandidatoResultado } from '../types/api';
import { formatearNumero } from '../utils/formatearNumero';
import { formatearPorcentaje } from '../utils/formatearPorcentaje';

interface Props {
  candidato: CandidatoResultado;
  esGanador: boolean;
}

export function TarjetaCandidato({ candidato, esGanador }: Props) {
  const colorBorde = esGanador ? candidato.color_hex : undefined;

  return (
    <article
      className={`bg-oficial-card rounded-lg p-5 shadow-sm relative ${
        esGanador ? 'border-2' : 'border border-oficial-border'
      }`}
      style={colorBorde ? { borderColor: colorBorde } : undefined}
      aria-label={`Resultados de ${candidato.nombre_candidato}`}
    >
      {esGanador && (
        <span
          className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold rounded text-white"
          style={{ backgroundColor: candidato.color_hex }}
        >
          PRIMER LUGAR
        </span>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: candidato.color_hex }}
          aria-hidden="true"
        >
          {candidato.sigla_candidato}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight truncate">
            {candidato.nombre_candidato}
          </h3>
          <p className="text-sm text-oficial-text-secondary">
            {candidato.sigla_partido}
          </p>
        </div>
      </div>

      <div>
        <p
          className="text-3xl font-bold tabular-nums"
          aria-label={`${formatearPorcentaje(candidato.porcentaje)} de votos`}
        >
          {formatearPorcentaje(candidato.porcentaje)}
        </p>
        <p className="text-sm text-oficial-text-secondary tabular-nums">
          {formatearNumero(candidato.votos_total)} votos
        </p>
      </div>

      <div className="mt-3 h-2 bg-oficial-border rounded overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.min(candidato.porcentaje, 100)}%`,
            backgroundColor: candidato.color_hex,
          }}
          role="progressbar"
          aria-valuenow={Math.round(candidato.porcentaje)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </article>
  );
}
