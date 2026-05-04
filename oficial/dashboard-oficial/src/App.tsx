import { lazy, Suspense } from 'react';
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

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto w-full px-6 py-8 space-y-8 flex-1">
        <ResultadosNacionales />
        <AvanceComputo />
        <Suspense fallback={<VisualizacionesSkeleton />}>
          <VisualizacionesGraficas />
        </Suspense>
        <ResultadosPorDepartamento />
        <PanelTransparencia />
        <EstadoClusterMirror />
      </main>
      <Footer />
    </div>
  );
}

export default App;
