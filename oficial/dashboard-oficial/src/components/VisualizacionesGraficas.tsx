import { useState } from 'react';
import { GraficaBarrasVerticales } from './graficas/GraficaBarrasVerticales';
import { GraficaComparativaPorDepto } from './graficas/GraficaComparativaPorDepto';
import { GraficaDonaPorDepartamento } from './graficas/GraficaDonaPorDepartamento';

type Tab = 'nacional' | 'depto' | 'comparativa';

const TABS: ReadonlyArray<{ id: Tab; label: string; descripcion: string }> = [
  {
    id: 'nacional',
    label: 'Vista Nacional',
    descripcion: 'Porcentajes globales por candidato',
  },
  {
    id: 'depto',
    label: 'Por Departamento',
    descripcion: 'Distribución de votos en un departamento específico',
  },
  {
    id: 'comparativa',
    label: 'Comparativa',
    descripcion: 'Performance de cada candidato en los 9 departamentos',
  },
];

export function VisualizacionesGraficas(): JSX.Element {
  const [tab, setTab] = useState<Tab>('nacional');
  const tabActual = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <section aria-labelledby="visualizaciones-titulo">
      <h2 id="visualizaciones-titulo" className="text-lg font-semibold mb-4">
        Visualizaciones
      </h2>
      <div className="bg-oficial-card border border-oficial-border rounded-lg overflow-hidden">
        <div
          role="tablist"
          aria-label="Visualizaciones disponibles"
          className="flex flex-wrap border-b border-oficial-border"
        >
          {TABS.map((t) => {
            const activo = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-controls={`panel-${t.id}`}
                aria-selected={activo}
                tabIndex={activo ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm border-b-2 transition-colors ${
                  activo
                    ? 'border-oficial-blue text-oficial-blue font-semibold'
                    : 'border-transparent text-oficial-text-secondary hover:bg-oficial-bg font-medium'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="p-6"
        >
          <p className="text-sm text-oficial-text-secondary mb-4">
            {tabActual.descripcion}
          </p>
          {tab === 'nacional' && <GraficaBarrasVerticales />}
          {tab === 'depto' && <GraficaDonaPorDepartamento />}
          {tab === 'comparativa' && <GraficaComparativaPorDepto />}
        </div>
      </div>
    </section>
  );
}
