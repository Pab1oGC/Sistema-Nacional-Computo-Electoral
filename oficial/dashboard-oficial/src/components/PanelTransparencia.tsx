import { useState } from 'react';
import { useAvance } from '../hooks/useAvance';
import { useInconsistencias } from '../hooks/useInconsistencias';
import { formatearNumero } from '../utils/formatearNumero';
import { DesgloseInconsistenciasModal } from './DesgloseInconsistenciasModal';

export function PanelTransparencia() {
  const inconsistencias = useInconsistencias();
  const { data: avance } = useAvance();
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);

  const validadas = avance?.actas_validadas ?? 0;

  return (
    <section aria-labelledby="transparencia-titulo">
      <h2 id="transparencia-titulo" className="text-lg font-semibold mb-4">
        Transparencia del cómputo
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Contador
          titulo="Actas validadas"
          valor={formatearNumero(validadas)}
          colorBarra="bg-oficial-green"
          descripcion="Actas correctamente procesadas"
        />
        <ContadorObservadas
          total={inconsistencias.totalObservadas}
          isLoading={inconsistencias.isLoading}
          isError={inconsistencias.isError}
          onAbrirDesglose={() => setModalAbierto(true)}
        />
        <Contador
          titulo="Actas descartadas"
          valor="—"
          colorBarra="bg-oficial-text-secondary"
          descripcion="Disponible próximamente"
          ariaLabel="Conteo de actas descartadas no disponible"
        />
      </div>
      <DesgloseInconsistenciasModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        aritmeticas={inconsistencias.errorAritmetico}
        discrepanciaMesa={inconsistencias.errorMesaInexistente}
        duplicadas={inconsistencias.errorDuplicado}
      />
    </section>
  );
}

interface ContadorProps {
  titulo: string;
  valor: string;
  colorBarra: string;
  descripcion: string;
  ariaLabel?: string;
}

function Contador({
  titulo,
  valor,
  colorBarra,
  descripcion,
  ariaLabel,
}: ContadorProps) {
  return (
    <article
      className="bg-oficial-card border border-oficial-border rounded-lg p-5"
      aria-label={ariaLabel ?? `${titulo}: ${valor}`}
    >
      <div className={`w-12 h-1 ${colorBarra} rounded mb-3`} aria-hidden="true" />
      <p className="text-sm text-oficial-text-secondary">{titulo}</p>
      <p className="text-3xl font-bold tabular-nums my-2">{valor}</p>
      <p className="text-xs text-oficial-text-secondary">{descripcion}</p>
    </article>
  );
}

interface ContadorObservadasProps {
  total: number;
  isLoading: boolean;
  isError: boolean;
  onAbrirDesglose: () => void;
}

function ContadorObservadas({
  total,
  isLoading,
  isError,
  onAbrirDesglose,
}: ContadorObservadasProps) {
  let valorMostrado: string;
  if (isLoading) {
    valorMostrado = '...';
  } else if (isError) {
    valorMostrado = '—';
  } else {
    valorMostrado = formatearNumero(total);
  }

  const puedeAbrir = !isLoading && !isError && total > 0;

  return (
    <article className="bg-oficial-card border border-oficial-border rounded-lg p-5">
      <div className="w-12 h-1 bg-oficial-yellow rounded mb-3" aria-hidden="true" />
      <p className="text-sm text-oficial-text-secondary">Actas observadas</p>
      <p className="text-3xl font-bold tabular-nums my-2">{valorMostrado}</p>
      <p className="text-xs text-oficial-text-secondary mb-2">
        Detectadas durante la validación, registradas para auditoría
      </p>
      {puedeAbrir && (
        <button
          type="button"
          onClick={onAbrirDesglose}
          className="text-xs text-oficial-blue underline hover:no-underline"
        >
          Ver desglose
        </button>
      )}
    </article>
  );
}
