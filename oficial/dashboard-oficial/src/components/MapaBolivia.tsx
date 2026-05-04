import 'leaflet/dist/leaflet.css';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GeoJSON, MapContainer } from 'react-leaflet';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import type { Layer, LeafletMouseEvent, PathOptions } from 'leaflet';
import { useResultados } from '../hooks/useResultados';
import { useResultadosPorDepto } from '../hooks/useResultadosPorDepto';
import { useResultadosPorMunicipio } from '../hooks/useResultadosPorMunicipio';
import { useResultadosPorProvincia } from '../hooks/useResultadosPorProvincia';
import type {
  DepartamentoResultados,
  MunicipioResultados,
  ProvinciaResultados,
} from '../types/api';
import {
  DetalleTerritorioModal,
  type DetalleTerritorioData,
} from './DetalleTerritorioModal';

const COLOR_SIN_DATOS = '#cbd5e1';
const CENTRO_BOLIVIA: [number, number] = [-16.5, -64.5];
const ZOOM_NACIONAL = 5;
const ZOOM_DEPTO = 7;
const ZOOM_PROVINCIA = 8;

interface PartidoMeta {
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
}

const PARTIDOS_FALLBACK: ReadonlyArray<PartidoMeta> = [
  { sigla_candidato: 'P1', nombre_candidato: 'Daenerys Targaryen', sigla_partido: 'MAS-ISP', color_hex: '#003087' },
  { sigla_candidato: 'P2', nombre_candidato: 'Sansa Stark', sigla_partido: 'CC', color_hex: '#E63946' },
  { sigla_candidato: 'P3', nombre_candidato: 'Robert Baratheon', sigla_partido: 'Creemos', color_hex: '#F4A261' },
  { sigla_candidato: 'P4', nombre_candidato: 'Tyrion Lannister', sigla_partido: 'APB', color_hex: '#2A9D8F' },
];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-]/g, '')
    .replace(/^departamentode/, '')
    .trim();
}

function calcularMargen(reg: { resultados_candidatos: { porcentaje: number }[] }): number {
  const ord = [...reg.resultados_candidatos].sort((a, b) => b.porcentaje - a.porcentaje);
  if (ord.length < 2) return 0;
  return Math.max(0, ord[0].porcentaje - ord[1].porcentaje);
}

function calcularOpacidad(margen: number): number {
  return Math.min(0.9, 0.4 + (margen / 100) * 0.5);
}

async function fetchGeoJSON(url: string): Promise<FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
  return (await res.json()) as FeatureCollection;
}

function useGeoDeptos() {
  return useQuery({
    queryKey: ['geo-departamentos'],
    queryFn: () => fetchGeoJSON('/geo/bolivia-departamentos.geojson'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

function useGeoProvincias(enabled: boolean) {
  return useQuery({
    queryKey: ['geo-provincias'],
    queryFn: () => fetchGeoJSON('/geo/bolivia-provincias.geojson'),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
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

interface NivelNacional { modo: 'nacional' }
interface NivelDepto { modo: 'departamento'; codDepto: number; nombreDepto: string }
interface NivelProv {
  modo: 'provincia';
  codDepto: number;
  nombreDepto: string;
  codProvincia: string;
  nombreProvincia: string;
}
type Nivel = NivelNacional | NivelDepto | NivelProv;

export function MapaBolivia(): JSX.Element {
  const [nivel, setNivel] = useState<Nivel>({ modo: 'nacional' });
  const [modal, setModal] = useState<DetalleTerritorioData | null>(null);
  const [modalNivel, setModalNivel] = useState<'depto' | 'provincia' | 'municipio' | null>(null);
  const [modalPayload, setModalPayload] = useState<
    DepartamentoResultados | ProvinciaResultados | MunicipioResultados | null
  >(null);

  const { data: deptosResp } = useResultadosPorDepto();
  const { data: nacional } = useResultados();
  const { data: provinciasResp } = useResultadosPorProvincia(
    nivel.modo === 'departamento' || nivel.modo === 'provincia' ? nivel.codDepto : null,
  );
  const { data: municipiosResp } = useResultadosPorMunicipio(
    nivel.modo === 'provincia' ? nivel.codDepto : null,
  );

  const { data: geoDeptos, isLoading: loadingGeoDeptos } = useGeoDeptos();
  const { data: geoProvincias, isLoading: loadingGeoProvincias } = useGeoProvincias(
    nivel.modo === 'departamento' || nivel.modo === 'provincia',
  );
  const { data: geoMunicipios, isLoading: loadingGeoMunicipios } = useGeoMunicipios(
    nivel.modo === 'provincia',
  );

  // Lookup partidos: del API de resultados nacionales
  const partidosMeta = useMemo<ReadonlyArray<PartidoMeta>>(() => {
    if (!nacional) return PARTIDOS_FALLBACK;
    return nacional.candidatos.map((c) => ({
      sigla_candidato: c.sigla_candidato,
      nombre_candidato: c.nombre_candidato,
      sigla_partido: c.sigla_partido,
      color_hex: c.color_hex,
    }));
  }, [nacional]);

  // Index de resultados por nombre normalizado para matching con GeoJSON
  const deptosByNombre = useMemo(() => {
    const map = new Map<string, DepartamentoResultados>();
    if (deptosResp) for (const d of deptosResp.departamentos) {
      map.set(normalizar(d.nombre_departamento), d);
    }
    return map;
  }, [deptosResp]);

  const provinciasByNombre = useMemo(() => {
    const map = new Map<string, ProvinciaResultados>();
    if (provinciasResp) for (const p of provinciasResp.provincias) {
      map.set(normalizar(p.nombre_provincia), p);
    }
    return map;
  }, [provinciasResp]);

  const municipiosByNombre = useMemo(() => {
    const map = new Map<string, MunicipioResultados>();
    if (municipiosResp) for (const m of municipiosResp.municipios) {
      map.set(normalizar(m.nombre_municipio), m);
    }
    return map;
  }, [municipiosResp]);

  // Filtros de GeoJSON según nivel
  const geoFiltrado = useMemo<FeatureCollection | null>(() => {
    if (nivel.modo === 'nacional') return geoDeptos ?? null;
    if (nivel.modo === 'departamento') {
      if (!geoProvincias) return null;
      return {
        type: 'FeatureCollection',
        features: geoProvincias.features.filter(
          (f) => Number(f.properties?.codigo_departamento) === nivel.codDepto,
        ),
      };
    }
    // provincia: filtrar municipios por NAME_2 (normalizado) == nombreProvincia
    if (!geoMunicipios) return null;
    const objetivoProv = normalizar(nivel.nombreProvincia);
    const objetivoDepto = normalizar(nivel.nombreDepto);
    return {
      type: 'FeatureCollection',
      features: geoMunicipios.features.filter((f) => {
        const name1 = String(f.properties?.NAME_1 ?? '');
        const name2 = String(f.properties?.NAME_2 ?? '');
        return (
          normalizar(name1) === objetivoDepto && normalizar(name2) === objetivoProv
        );
      }),
    };
  }, [nivel, geoDeptos, geoProvincias, geoMunicipios]);

  // Style por feature
  const styleFeature = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
      if (!feature) return { fillColor: COLOR_SIN_DATOS, weight: 1, color: '#000', fillOpacity: 0.2 };
      let reg: { ganador: { color_hex: string } | null; resultados_candidatos: { porcentaje: number }[] } | undefined;
      if (nivel.modo === 'nacional') {
        const nombre = String(feature.properties?.NOM_DEP ?? '');
        reg = deptosByNombre.get(normalizar(nombre));
      } else if (nivel.modo === 'departamento') {
        const nombre = String(feature.properties?.nombre ?? '');
        reg = provinciasByNombre.get(normalizar(nombre));
      } else {
        const nombre = String(feature.properties?.NAME_3 ?? '');
        reg = municipiosByNombre.get(normalizar(nombre));
      }
      if (!reg || !reg.ganador) {
        return {
          fillColor: COLOR_SIN_DATOS,
          weight: nivel.modo === 'nacional' ? 1.5 : 1,
          color: '#000',
          fillOpacity: 0.2,
          opacity: 1,
        };
      }
      return {
        fillColor: reg.ganador.color_hex,
        weight: nivel.modo === 'nacional' ? 1.5 : 1,
        color: '#000',
        fillOpacity: calcularOpacidad(calcularMargen(reg)),
        opacity: 1,
      };
    },
    [nivel, deptosByNombre, provinciasByNombre, municipiosByNombre],
  );

  // Click → modal
  const abrirModalDepto = useCallback(
    (depto: DepartamentoResultados) => {
      setModalNivel('depto');
      setModalPayload(depto);
      setModal({
        nombre: depto.nombre_departamento,
        contexto: 'Departamento · Bolivia',
        totalMesas: depto.total_mesas_depto,
        actasValidadas: depto.actas_validadas_depto,
        porcentajeAvance: depto.porcentaje_avance_depto,
        ganador: depto.ganador,
        resultadosCandidatos: depto.resultados_candidatos,
        drillDownLabel: 'Ver provincias',
      });
    },
    [],
  );

  const abrirModalProvincia = useCallback(
    (prov: ProvinciaResultados, nombreDepto: string) => {
      setModalNivel('provincia');
      setModalPayload(prov);
      setModal({
        nombre: prov.nombre_provincia,
        contexto: `Provincia · ${nombreDepto}`,
        totalMesas: prov.total_mesas_provincia,
        actasValidadas: prov.actas_validadas_provincia,
        porcentajeAvance: prov.porcentaje_avance_provincia,
        ganador: prov.ganador,
        resultadosCandidatos: prov.resultados_candidatos,
        drillDownLabel: 'Ver municipios',
      });
    },
    [],
  );

  const abrirModalMunicipio = useCallback(
    (muni: MunicipioResultados, nombreProv: string, nombreDepto: string) => {
      setModalNivel('municipio');
      setModalPayload(muni);
      setModal({
        nombre: muni.nombre_municipio,
        contexto: `Municipio · ${nombreProv} · ${nombreDepto}`,
        totalMesas: muni.total_mesas_municipio,
        actasValidadas: muni.actas_validadas_municipio,
        porcentajeAvance: muni.porcentaje_avance_municipio,
        ganador: muni.ganador,
        resultadosCandidatos: muni.resultados_candidatos,
        drillDownLabel: undefined,
      });
    },
    [],
  );

  const handleDrillDown = useCallback(() => {
    if (modalNivel === 'depto' && modalPayload) {
      const depto = modalPayload as DepartamentoResultados;
      setNivel({
        modo: 'departamento',
        codDepto: depto.id_departamento,
        nombreDepto: depto.nombre_departamento,
      });
    } else if (modalNivel === 'provincia' && modalPayload && nivel.modo !== 'nacional') {
      const prov = modalPayload as ProvinciaResultados;
      setNivel({
        modo: 'provincia',
        codDepto: nivel.codDepto,
        nombreDepto: nivel.nombreDepto,
        codProvincia: prov.codigo_provincia,
        nombreProvincia: prov.nombre_provincia,
      });
    }
    setModal(null);
    setModalNivel(null);
    setModalPayload(null);
  }, [modalNivel, modalPayload, nivel]);

  // onEachFeature: tooltip + click
  const onEachFeature = useCallback(
    (feature: Feature, layer: Layer): void => {
      let nombre = '';
      let textoTooltip = '';
      let clickHandler: (() => void) | null = null;

      if (nivel.modo === 'nacional') {
        nombre = String(feature.properties?.NOM_DEP ?? '');
        const depto = deptosByNombre.get(normalizar(nombre));
        textoTooltip = depto?.ganador
          ? `<strong>${nombre}</strong><br/>` +
            `Ganador: ${depto.ganador.sigla_partido} (${depto.ganador.porcentaje.toFixed(1)}%)<br/>` +
            `Avance: ${depto.actas_validadas_depto}/${depto.total_mesas_depto} ` +
            `(${depto.porcentaje_avance_depto.toFixed(1)}%)`
          : `<strong>${nombre}</strong><br/>Sin actas procesadas`;
        if (depto) clickHandler = () => abrirModalDepto(depto);
      } else if (nivel.modo === 'departamento') {
        nombre = String(feature.properties?.nombre ?? '');
        const prov = provinciasByNombre.get(normalizar(nombre));
        textoTooltip = prov?.ganador
          ? `<strong>${nombre}</strong><br/>` +
            `Ganador: ${prov.ganador.sigla_partido} (${prov.ganador.porcentaje.toFixed(1)}%)<br/>` +
            `Avance: ${prov.actas_validadas_provincia}/${prov.total_mesas_provincia} ` +
            `(${prov.porcentaje_avance_provincia.toFixed(1)}%)`
          : `<strong>${nombre}</strong><br/>Sin actas procesadas`;
        if (prov) clickHandler = () => abrirModalProvincia(prov, nivel.nombreDepto);
      } else {
        nombre = String(feature.properties?.NAME_3 ?? '');
        const muni = municipiosByNombre.get(normalizar(nombre));
        textoTooltip = muni?.ganador
          ? `<strong>${nombre}</strong><br/>` +
            `Ganador: ${muni.ganador.sigla_partido} (${muni.ganador.porcentaje.toFixed(1)}%)<br/>` +
            `Avance: ${muni.actas_validadas_municipio}/${muni.total_mesas_municipio} ` +
            `(${muni.porcentaje_avance_municipio.toFixed(1)}%)`
          : `<strong>${nombre}</strong><br/>Sin actas procesadas`;
        if (muni) clickHandler = () => abrirModalMunicipio(muni, nivel.nombreProvincia, nivel.nombreDepto);
      }

      // Tooltip permanente para deptos, hover-only para niveles más finos
      const permanent = nivel.modo === 'nacional';
      layer.bindTooltip(textoTooltip, { sticky: !permanent, permanent, direction: 'center' });

      layer.on({
        click: () => {
          if (clickHandler) clickHandler();
        },
        mouseover: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({ weight: 3, color: '#1A2332' });
        },
        mouseout: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({
            weight: nivel.modo === 'nacional' ? 1.5 : 1,
            color: '#000',
          });
        },
      });
    },
    [nivel, deptosByNombre, provinciasByNombre, municipiosByNombre, abrirModalDepto, abrirModalProvincia, abrirModalMunicipio],
  );

  const cargandoNivel =
    (nivel.modo === 'nacional' && (loadingGeoDeptos || !deptosResp)) ||
    (nivel.modo === 'departamento' && (loadingGeoProvincias || !provinciasResp)) ||
    (nivel.modo === 'provincia' && (loadingGeoMunicipios || !municipiosResp));

  const zoom =
    nivel.modo === 'nacional' ? ZOOM_NACIONAL :
    nivel.modo === 'departamento' ? ZOOM_DEPTO :
    ZOOM_PROVINCIA;

  return (
    <section aria-labelledby="mapa-titulo">
      <h2 id="mapa-titulo" className="text-lg font-semibold mb-1">
        Mapa Electoral de Bolivia
      </h2>
      <p className="text-sm text-oficial-text-secondary mb-4">
        Cada territorio se colorea según el partido ganador. La intensidad refleja
        el margen de victoria. Click sobre un territorio abre el detalle.
      </p>

      {/* Breadcrumb */}
      <nav
        aria-label="Navegación del mapa"
        className="bg-oficial-card border border-oficial-border rounded-t-lg px-4 py-2 flex items-center gap-2 text-sm"
      >
        <button
          type="button"
          onClick={() => setNivel({ modo: 'nacional' })}
          disabled={nivel.modo === 'nacional'}
          className={
            nivel.modo === 'nacional'
              ? 'font-semibold text-oficial-text cursor-default'
              : 'text-oficial-blue hover:underline'
          }
        >
          Bolivia
        </button>
        {nivel.modo !== 'nacional' && (
          <>
            <span className="text-oficial-text-secondary">›</span>
            <button
              type="button"
              onClick={() =>
                setNivel({
                  modo: 'departamento',
                  codDepto: nivel.codDepto,
                  nombreDepto: nivel.nombreDepto,
                })
              }
              disabled={nivel.modo === 'departamento'}
              className={
                nivel.modo === 'departamento'
                  ? 'font-semibold text-oficial-text cursor-default'
                  : 'text-oficial-blue hover:underline'
              }
            >
              {nivel.nombreDepto}
            </button>
          </>
        )}
        {nivel.modo === 'provincia' && (
          <>
            <span className="text-oficial-text-secondary">›</span>
            <span className="font-semibold text-oficial-text">
              {nivel.nombreProvincia}
            </span>
          </>
        )}
        {nivel.modo !== 'nacional' && (
          <button
            type="button"
            onClick={() => {
              if (nivel.modo === 'provincia') {
                setNivel({
                  modo: 'departamento',
                  codDepto: nivel.codDepto,
                  nombreDepto: nivel.nombreDepto,
                });
              } else {
                setNivel({ modo: 'nacional' });
              }
            }}
            className="ml-auto text-xs text-oficial-blue hover:underline"
          >
            ← Atrás
          </button>
        )}
      </nav>

      <div className="bg-white border border-oficial-border border-t-0 rounded-b-lg p-2">
        {cargandoNivel || !geoFiltrado ? (
          <div
            className="h-[600px] bg-oficial-bg rounded animate-pulse"
            aria-hidden="true"
          />
        ) : (
          <MapContainer
            key={`${nivel.modo}-${'codDepto' in nivel ? nivel.codDepto : ''}-${'codProvincia' in nivel ? nivel.codProvincia : ''}`}
            center={CENTRO_BOLIVIA}
            zoom={zoom}
            scrollWheelZoom={false}
            style={{ height: '600px', width: '100%', borderRadius: '6px', backgroundColor: '#f8fafc' }}
          >
            <GeoJSON
              key={`features-${nivel.modo}`}
              data={geoFiltrado}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          </MapContainer>
        )}
        <Leyenda partidos={partidosMeta} />
      </div>

      {modal && (
        <DetalleTerritorioModal
          data={modal}
          partidosMeta={partidosMeta}
          onClose={() => {
            setModal(null);
            setModalNivel(null);
            setModalPayload(null);
          }}
          onDrillDown={modal.drillDownLabel ? handleDrillDown : undefined}
        />
      )}
    </section>
  );
}

function Leyenda({
  partidos,
}: {
  partidos: ReadonlyArray<PartidoMeta>;
}): JSX.Element {
  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm px-2 pb-1">
      <div>
        <h4 className="font-semibold text-oficial-text mb-1 text-xs">
          Color por partido ganador
        </h4>
        <div className="flex flex-wrap gap-2">
          {partidos.map((c) => (
            <span
              key={c.sigla_candidato}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-white text-xs"
              style={{ backgroundColor: c.color_hex }}
            >
              {c.sigla_partido}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-oficial-border text-oficial-text-secondary">
            Sin datos
          </span>
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-oficial-text mb-1 text-xs">
          Intensidad por margen de victoria
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-oficial-text-secondary">Reñido</span>
          <div
            className="h-2.5 flex-1 rounded"
            style={{
              background:
                'linear-gradient(to right, rgba(30,74,140,0.4), rgba(30,74,140,0.9))',
            }}
            aria-hidden="true"
          />
          <span className="text-[10px] text-oficial-text-secondary">Dominio</span>
        </div>
      </div>
    </div>
  );
}
