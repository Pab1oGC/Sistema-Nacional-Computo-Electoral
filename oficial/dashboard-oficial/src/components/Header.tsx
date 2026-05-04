import { useEffect, useState } from 'react';
import { useEstadoSistema } from '../hooks/useEstadoSistema';

export function Header() {
  const [hora, setHora] = useState<Date>(() => new Date());
  const { data: health, isError } = useEstadoSistema();

  useEffect(() => {
    const id = window.setInterval(() => setHora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const horaStr = hora.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const fechaStr = hora.toLocaleDateString('es-BO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sistemaOk = !isError && health?.status === 'ok';
  const estadoTexto = sistemaOk ? 'Sistema activo' : 'Sistema con incidencia';
  const estadoColor = sistemaOk ? 'bg-oficial-green' : 'bg-oficial-yellow';

  return (
    <header className="bg-oficial-blue text-white border-b border-oficial-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-md bg-white text-oficial-blue flex items-center justify-center font-bold text-lg"
            aria-hidden="true"
          >
            TO
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">TREP Cómputo Oficial</h1>
            <p className="text-sm opacity-90 capitalize">
              {fechaStr} · Bolivia 2025
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs opacity-80">Hora actual</p>
            <p className="text-2xl font-mono tabular-nums tracking-wide">
              {horaStr}
            </p>
          </div>
          <div className="flex items-center gap-2" aria-live="polite">
            <span
              className={`w-3 h-3 rounded-full ${estadoColor}`}
              aria-hidden="true"
            />
            <span className="text-sm">{estadoTexto}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
