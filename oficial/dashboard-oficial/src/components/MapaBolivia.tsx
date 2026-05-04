import 'leaflet/dist/leaflet.css';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import type { Layer, LeafletMouseEvent, PathOptions } from 'leaflet';
import { useResultados } from '../hooks/useResultados';
import { useResultadosPorDepto } from '../hooks/useResultadosPorDepto';
import { useResultadosPorMunicipio } from '../hooks/useResultadosPorMunicipio';
import type {
  DepartamentoResultados,
  MunicipioResultados,
} from '../types/api';

const COLOR_SIN_DATOS = '#cccccc';
const COLOR_BORDE_DEFAULT = '#ffffff';
const COLOR_BORDE_HOVER = '#1A2332';
const CENTRO_BOLIVIA: [number, number] = [-16.5, -64.5];
const ZOOM_NACIONAL = 5;
const ZOOM_DEPTO = 7;

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-]/g, '')
    .replace(/^departamentode/, '')
    .trim();
}

function calcularMargen(depto: DepartamentoResultados | MunicipioResultados): number {
  const ordenados = [...depto.resultados_candidatos].sort(
    (a, b) => b.porcentaje - a.porcentaje,
  );
  if (ordenados.length < 2) return 0;
  return Math.max(0, ordenados[0].porcentaje - ordenados[1].porcentaje);
}

function calcularOpacidad(margen: number): number {
  return 0.4 + Math.min(margen / 50, 1) * 0.6;
}

async function fetchGeoJSON(url: string): Promise<FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
  return (await res.json()) as FeatureCollection;
}

function useGeoDepartamentos() {
  return useQuery({
    queryKey: ['geo-departamentos'],
    queryFn: () => fetchGeoJSON('/geo/bolivia-departamentos.geojson'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

function useGeoMunicipios(enabled: boolean) {
  return useQuery({
    queryKey: ['geo-municipios'],
    queryFn: () => fetchGeoJSON('/geo/bolivia-municipios.geojson'),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  });
}

interface NivelDepto {
  modo: 'depto';
}

interface NivelMunicipio {
  modo: 'municipio';
  codigoDepto: number;
  nombreDepto: string;
}

type Nivel = NivelDepto | NivelMunicipio;

export function MapaBolivia(): JSX.Element {
  const [nivel, setNivel] = useState<Nivel>({ modo: 'depto' });
  const { data: deptos } = useResultadosPorDepto();
  const { data: nacional } = useResultados();
  const { data: geoDeptos, isLoading: loadingGeoDeptos } = useGeoDepartamentos();
  const { data: geoMunicipios, isLoading: loadingGeoMunicipios } = useGeoMunicipios(
    nivel.modo === 'municipio',
  );
  const { data: dataMunicipios } = useResultadosPorMunicipio(
    nivel.modo === 'municipio' ? nivel.codigoDepto : null,
  );

  const deptosByNombre = useMemo(() => {
    const map = new Map<string, DepartamentoResultados>();
    if (deptos) {
      for (const d of deptos.departamentos) {
        map.set(normalizar(d.nombre_departamento), d);
      }
    }
    return map;
  }, [deptos]);

  const municipiosByNombre = useMemo(() => {
    const map = new Map<string, MunicipioResultados>();
    if (dataMunicipios) {
      for (const m of dataMunicipios.municipios) {
        map.set(normalizar(m.nombre_municipio), m);
      }
    }
    return map;
  }, [dataMunicipios]);

  const geoMunicipiosFiltrados = useMemo<FeatureCollection | null>(() => {
    if (nivel.modo !== 'municipio' || !geoMunicipios) return null;
    const objetivo = normalizar(nivel.nombreDepto);
    return {
      type: 'FeatureCollection',
      features: geoMunicipios.features.filter((f) => {
        const nameDepto = (f.properties?.NAME_1 ?? '') as string;
        return normalizar(nameDepto) === objetivo;
      }),
    };
  }, [nivel, geoMunicipios]);

  const styleDepto = (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
    const nombre = (feature?.properties?.NOM_DEP ?? '') as string;
    const depto = deptosByNombre.get(normalizar(nombre));
    if (!depto || !depto.ganador) {
      return {
        fillColor: COLOR_SIN_DATOS,
        weight: 1,
        color: '#888',
        fillOpacity: 0.3,
        opacity: 1,
      };
    }
    return {
      fillColor: depto.ganador.color_hex,
      weight: 1.5,
      color: COLOR_BORDE_DEFAULT,
      fillOpacity: calcularOpacidad(calcularMargen(depto)),
      opacity: 1,
    };
  };

  const styleMunicipio = (
    feature?: Feature<Geometry, GeoJsonProperties>,
  ): PathOptions => {
    const nombre = (feature?.properties?.NAME_3 ?? '') as string;
    const muni = municipiosByNombre.get(normalizar(nombre));
    if (!muni || !muni.ganador) {
      return {
        fillColor: COLOR_SIN_DATOS,
        weight: 0.8,
        color: '#888',
        fillOpacity: 0.3,
        opacity: 1,
      };
    }
    return {
      fillColor: muni.ganador.color_hex,
      weight: 1,
      color: COLOR_BORDE_DEFAULT,
      fillOpacity: calcularOpacidad(calcularMargen(muni)),
      opacity: 1,
    };
  };

  const onEachDepto = (feature: Feature, layer: Layer): void => {
    const nombre = (feature.properties?.NOM_DEP ?? '') as string;
    const depto = deptosByNombre.get(normalizar(nombre));
    const tooltip = depto?.ganador
      ? `<strong>${nombre}</strong><br/>` +
        `Ganador: ${depto.ganador.nombre_candidato} (${depto.ganador.sigla_partido})<br/>` +
        `Porcentaje: ${depto.ganador.porcentaje.toFixed(1)}%<br/>` +
        `Avance: ${depto.porcentaje_avance_depto.toFixed(1)}%`
      : `<strong>${nombre}</strong><br/>Sin actas validadas`;
    layer.bindTooltip(tooltip, { sticky: true });
    layer.on({
      click: () => {
        if (depto) {
          setNivel({
            modo: 'municipio',
            codigoDepto: depto.id_departamento,
            nombreDepto: depto.nombre_departamento,
          });
        }
      },
      mouseover: (e: LeafletMouseEvent) => {
        const path = e.target as { setStyle?: (s: PathOptions) => void };
        path.setStyle?.({ weight: 3, color: COLOR_BORDE_HOVER });
      },
      mouseout: (e: LeafletMouseEvent) => {
        const path = e.target as { setStyle?: (s: PathOptions) => void };
        path.setStyle?.({ weight: 1.5, color: COLOR_BORDE_DEFAULT });
      },
    });
  };

  const onEachMunicipio = (feature: Feature, layer: Layer): void => {
    const nombre = (feature.properties?.NAME_3 ?? '') as string;
    const muni = municipiosByNombre.get(normalizar(nombre));
    const tooltip = muni?.ganador
      ? `<strong>${muni.nombre_municipio}</strong><br/>` +
        `Ganador: ${muni.ganador.nombre_candidato} (${muni.ganador.sigla_partido})<br/>` +
        `Porcentaje: ${muni.ganador.porcentaje.toFixed(1)}%<br/>` +
        `Avance: ${muni.porcentaje_avance_municipio.toFixed(1)}%`
      : `<strong>${nombre}</strong><br/>Sin datos`;
    layer.bindTooltip(tooltip, { sticky: true });
    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        const path = e.target as { setStyle?: (s: PathOptions) => void };
        path.setStyle?.({ weight: 2.5, color: COLOR_BORDE_HOVER });
      },
      mouseout: (e: LeafletMouseEvent) => {
        const path = e.target as { setStyle?: (s: PathOptions) => void };
        path.setStyle?.({ weight: 1, color: COLOR_BORDE_DEFAULT });
      },
    });
  };

  const cargandoNacional = loadingGeoDeptos || !deptos || !nacional;
  const cargandoDepto =
    nivel.modo === 'municipio' && (loadingGeoMunicipios || !dataMunicipios);

  return (
    <section aria-labelledby="mapa-titulo">
      <h2 id="mapa-titulo" className="text-lg font-semibold mb-1">
        Mapa Electoral de Bolivia
      </h2>
      <p className="text-sm text-oficial-text-secondary mb-4">
        Cada departamento se colorea según el partido ganador. La intensidad del
        color refleja qué tan dominante fue la victoria. Click sobre un
        departamento para ver el detalle por municipio.
      </p>
      <div className="bg-oficial-card border border-oficial-border rounded-lg p-4">
        {nivel.modo === 'municipio' && (
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setNivel({ modo: 'depto' })}
              className="text-sm text-oficial-blue hover:underline"
            >
              ← Volver a vista nacional
            </button>
            <span className="text-sm font-medium text-oficial-text">
              {nivel.nombreDepto}
            </span>
          </div>
        )}
        {nivel.modo === 'depto' ? (
          cargandoNacional || !geoDeptos ? (
            <div
              className="h-[600px] bg-oficial-bg rounded animate-pulse"
              aria-hidden="true"
            />
          ) : (
            <MapContainer
              center={CENTRO_BOLIVIA}
              zoom={ZOOM_NACIONAL}
              scrollWheelZoom={false}
              style={{ height: '600px', width: '100%', borderRadius: '8px' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <GeoJSON
                key="deptos"
                data={geoDeptos}
                style={styleDepto}
                onEachFeature={onEachDepto}
              />
            </MapContainer>
          )
        ) : cargandoDepto || !geoMunicipiosFiltrados ? (
          <div
            className="h-[600px] bg-oficial-bg rounded animate-pulse"
            aria-hidden="true"
          />
        ) : (
          <MapContainer
            center={CENTRO_BOLIVIA}
            zoom={ZOOM_DEPTO}
            scrollWheelZoom={false}
            style={{ height: '600px', width: '100%', borderRadius: '8px' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <GeoJSON
              key={`muni-${nivel.codigoDepto}`}
              data={geoMunicipiosFiltrados}
              style={styleMunicipio}
              onEachFeature={onEachMunicipio}
            />
          </MapContainer>
        )}
        <Leyenda />
      </div>
    </section>
  );
}

interface ChipPartido {
  sigla: string;
  color: string;
}

const CHIPS: ReadonlyArray<ChipPartido> = [
  { sigla: 'MAS-ISP', color: '#003087' },
  { sigla: 'CC', color: '#E63946' },
  { sigla: 'Creemos', color: '#F4A261' },
  { sigla: 'APB', color: '#2A9D8F' },
];

function Leyenda(): JSX.Element {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <h4 className="font-semibold text-oficial-text mb-2">
          Color por partido ganador
        </h4>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <span
              key={c.sigla}
              className="inline-flex items-center gap-2 px-2 py-1 rounded text-white text-xs"
              style={{ backgroundColor: c.color }}
            >
              {c.sigla}
            </span>
          ))}
          <span className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs border border-oficial-border text-oficial-text-secondary">
            Sin datos
          </span>
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-oficial-text mb-2">
          Intensidad por margen de victoria
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-oficial-text-secondary">Reñido</span>
          <div
            className="h-3 flex-1 rounded"
            style={{
              background:
                'linear-gradient(to right, rgba(30,74,140,0.4), rgba(30,74,140,1))',
            }}
            aria-hidden="true"
          />
          <span className="text-xs text-oficial-text-secondary">Dominio</span>
        </div>
      </div>
    </div>
  );
}
