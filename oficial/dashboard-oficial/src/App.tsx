import { lazy, Suspense, useState } from 'react';
import { AvanceComputo } from './components/AvanceComputo';
import { EstadoClusterMirror } from './components/EstadoClusterMirror';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PanelTransparencia } from './components/PanelTransparencia';
import { ResultadosNacionales } from './components/ResultadosNacionales';
import { ResultadosPorDepartamento } from './components/ResultadosPorDepartamento';

const VisualizacionesGraficas = lazy(() =>
  import('./components/VisualizacionesGraficas').then((m) => ({
    default: m.VisualizacionesGraficas,
  })),
);

const MapaBolivia = lazy(() =>
  import('./components/MapaBolivia').then((m) => ({
    default: m.MapaBolivia,
  })),
);

const ActasLoaderView = lazy(() =>
  import('./components/actas-loader/ActasLoaderView').then((m) => ({
    default: m.ActasLoaderView,
  })),
);

function VisualizacionesSkeleton(): JSX.Element {
  return (
    <section aria-labelledby="visualizaciones-titulo">
      <h2 id="visualizaciones-titulo" className="text-lg font-semibold mb-4">
        Visualizaciones
      </h2>
      <div
        className="bg-oficial-card border border-oficial-border rounded-lg h-[500px] animate-pulse"
        aria-hidden="true"
      />
    </section>
  );
}

function MapaSkeleton(): JSX.Element {
  return (
    <section aria-labelledby="mapa-titulo">
      <h2 id="mapa-titulo" className="text-lg font-semibold mb-4">
        Mapa Electoral de Bolivia
      </h2>
      <div
        className="bg-oficial-card border border-oficial-border rounded-lg h-[700px] animate-pulse"
        aria-hidden="true"
      />
    </section>
  );
}

function ActasLoaderSkeleton(): JSX.Element {
  return (
    <section aria-labelledby="actas-loader-titulo">
      <h2 id="actas-loader-titulo" className="text-lg font-semibold mb-4">
        Carga de Actas
      </h2>
      <div
        className="bg-oficial-card border border-oficial-border rounded-lg h-[600px] animate-pulse"
        aria-hidden="true"
      />
    </section>
  );
}

function ResultadosView(): JSX.Element {
  return (
    <div className="space-y-8">
      <ResultadosNacionales />
      <AvanceComputo />
      <Suspense fallback={<VisualizacionesSkeleton />}>
        <VisualizacionesGraficas />
      </Suspense>
      <Suspense fallback={<MapaSkeleton />}>
        <MapaBolivia />
      </Suspense>
      <ResultadosPorDepartamento />
      <PanelTransparencia />
      <EstadoClusterMirror />
    </div>
  );
}

type Tab = 'resultados' | 'carga';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'resultados', label: 'Resultados Nacionales' },
  { id: 'carga', label: 'Carga de Actas' },
];

function App() {
  const [tab, setTab] = useState<Tab>('resultados');
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <nav
        className="border-b border-oficial-border bg-oficial-card"
        role="tablist"
        aria-label="Vistas del dashboard"
      >
        <div className="max-w-7xl mx-auto px-6 flex">
          {TABS.map((t) => {
            const activo = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activo}
                tabIndex={activo ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm border-b-2 transition-colors ${
                  activo
                    ? 'border-oficial-blue text-oficial-blue font-semibold'
                    : 'border-transparent text-oficial-text-secondary hover:text-oficial-text font-medium'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {tab === 'resultados' && <ResultadosView />}
        {tab === 'carga' && (
          <Suspense fallback={<ActasLoaderSkeleton />}>
            <ActasLoaderView />
          </Suspense>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;
