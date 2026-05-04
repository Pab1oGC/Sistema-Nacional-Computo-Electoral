import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GeoJSON, MapContainer, useMap } from 'react-leaflet';
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from 'geojson';
import L from 'leaflet';
import type { LatLngBoundsExpression, Layer, LeafletMouseEvent, PathOptions } from 'leaflet';
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
  PanelLateralMapa,
  type DetalleData,
  type ItemListaTerritorio,
} from './PanelLateralMapa';

const COLOR_SIN_DATOS = '#cbd5e1';
const COLOR_HIGHLIGHT_STROKE = '#0ea5e9';

// Colores de "contexto opacado": territorios fuera del foco actual.
const COLOR_CONTEXT_DEPTOS = '#cbd5e1';     // slate-300 — deptos cuando no es el nivel activo
const COLOR_CONTEXT_PROVS = '#94a3b8';      // slate-400 — provincias del depto cuando estamos en provincia
const COLOR_CONTEXT_STROKE = '#64748b';     // slate-500

// Bounds reales de Bolivia para el primer paint.
const BOLIVIA_REAL_BOUNDS: LatLngBoundsExpression = [
  [-22.9, -69.6],
  [-9.7, -57.5],
];

// Bounds máximos de pan: el usuario puede arrastrar el mapa pero
// nunca salirse de la región de Bolivia (con un margen mínimo).
const MAX_BOUNDS: LatLngBoundsExpression = [
  [-24, -71],
  [-8, -55],
];

// Centro geográfico de Bolivia. Se usa como punto de referencia para
// interpolar el centro del viewport al hacer zoom dinámico.
const BOLIVIA_CENTER: [number, number] = [-16.29, -63.59];

// Niveles de zoom por nivel de drill-down. Más zoom = más detalle.
const ZOOM_BY_NIVEL: Record<'nacional' | 'departamento' | 'provincia', number> = {
  nacional: 6,
  departamento: 7,
  provincia: 8,
};

// Interpolación 50% entre el centro de Bolivia y el centro del territorio
// enfocado: el mapa se desplaza HACIA el territorio sin "escapar" de Bolivia.
function interpolarCentro(
  base: [number, number],
  target: [number, number],
  t: number,
): [number, number] {
  return [base[0] + (target[0] - base[0]) * t, base[1] + (target[1] - base[1]) * t];
}

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

// Helper: controla el zoom, centro y drag del mapa según el nivel actual.
// - Nivel nacional: mapa fijo (no drag), bounds Bolivia entera.
// - Niveles depto/provincia: drag habilitado pero limitado a maxBounds
//   (el usuario puede mover pero no escapar de la región de Bolivia).
function MapZoomController({
  nivel,
  targetCenter,
}: {
  nivel: 'nacional' | 'departamento' | 'provincia';
  targetCenter: [number, number] | null;
}): null {
  const map = useMap();

  // Primer paint: bounds Bolivia para llenar viewport
  useEffect(() => {
    map.fitBounds(BOLIVIA_REAL_BOUNDS, { padding: [4, 4], animate: false });
    const t = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(BOLIVIA_REAL_BOUNDS, { padding: [4, 4], animate: false });
    }, 50);
    return () => window.clearTimeout(t);
  }, [map]);

  // Cambio de nivel → setView con zoom + centro interpolado, y
  // enable/disable de dragging + maxBounds según corresponda.
  useEffect(() => {
    const targetZoom = ZOOM_BY_NIVEL[nivel];
    const center =
      nivel === 'nacional' || !targetCenter
        ? BOLIVIA_CENTER
        : interpolarCentro(BOLIVIA_CENTER, targetCenter, 0.5);
    map.setView(center, targetZoom, {
      animate: true,
      duration: 0.6,
      easeLinearity: 0.5,
    });

    // Drag + bounds según nivel
    if (nivel === 'nacional') {
      map.dragging.disable();
      map.setMaxBounds(undefined as unknown as L.LatLngBounds);
    } else {
      map.dragging.enable();
      map.setMaxBounds(MAX_BOUNDS as L.LatLngBoundsExpression);
      map.options.maxBoundsViscosity = 1.0;
    }
  }, [map, nivel, targetCenter]);

  return null;
}

export function MapaBolivia(): JSX.Element {
  const [nivel, setNivel] = useState<Nivel>({ modo: 'nacional' });

  // Detalle del panel lateral
  const [detalle, setDetalle] = useState<DetalleData | null>(null);
  const [detalleNivel, setDetalleNivel] = useState<'depto' | 'provincia' | 'municipio' | null>(null);
  const [detallePayload, setDetallePayload] = useState<
    DepartamentoResultados | ProvinciaResultados | MunicipioResultados | null
  >(null);

  // Highlight: id del feature seleccionado (para stroke grueso)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const { data: deptosResp, dataUpdatedAt: deptosUpdatedAt } = useResultadosPorDepto();
  const { data: nacional } = useResultados();
  const { data: provinciasResp, dataUpdatedAt: provUpdatedAt } =
    useResultadosPorProvincia(
      nivel.modo === 'departamento' || nivel.modo === 'provincia'
        ? nivel.codDepto
        : null,
    );
  const { data: municipiosResp, dataUpdatedAt: muniUpdatedAt } =
    useResultadosPorMunicipio(
      nivel.modo === 'provincia' ? nivel.codDepto : null,
    );

  // Single source para forzar remount del GeoJSON cuando llegan datos nuevos.
  const dataUpdatedAt =
    nivel.modo === 'nacional'
      ? deptosUpdatedAt
      : nivel.modo === 'departamento'
        ? provUpdatedAt
        : muniUpdatedAt;

  const { data: geoDeptos, isLoading: loadingGeoDeptos } = useGeoDeptos();
  const { data: geoProvincias, isLoading: loadingGeoProvincias } = useGeoProvincias(
    nivel.modo === 'departamento' || nivel.modo === 'provincia',
  );
  const { data: geoMunicipios, isLoading: loadingGeoMunicipios } = useGeoMunicipios(
    nivel.modo === 'provincia',
  );

  const partidosMeta = useMemo<ReadonlyArray<PartidoMeta>>(() => {
    if (!nacional) return PARTIDOS_FALLBACK;
    return nacional.candidatos.map((c) => ({
      sigla_candidato: c.sigla_candidato,
      nombre_candidato: c.nombre_candidato,
      sigla_partido: c.sigla_partido,
      color_hex: c.color_hex,
    }));
  }, [nacional]);

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

  // Provincias filtradas al depto enfocado (cuando hay uno).
  const geoProvinciasFiltrado = useMemo<FeatureCollection | null>(() => {
    if (nivel.modo === 'nacional' || !geoProvincias) return null;
    return {
      type: 'FeatureCollection',
      features: geoProvincias.features.filter(
        (f) => Number(f.properties?.codigo_departamento) === nivel.codDepto,
      ),
    };
  }, [nivel, geoProvincias]);

  // Municipios filtrados a la provincia enfocada (cuando estamos en provincia).
  const geoMunicipiosFiltrado = useMemo<FeatureCollection | null>(() => {
    if (nivel.modo !== 'provincia' || !geoMunicipios) return null;
    const objetivoProv = normalizar(nivel.nombreProvincia);
    const objetivoDepto = normalizar(nivel.nombreDepto);
    return {
      type: 'FeatureCollection',
      features: geoMunicipios.features.filter((f) => {
        const name1 = String(f.properties?.NAME_1 ?? '');
        const name2 = String(f.properties?.NAME_2 ?? '');
        return (
          normalizar(name1) === objetivoDepto &&
          normalizar(name2) === objetivoProv
        );
      }),
    };
  }, [nivel, geoMunicipios]);

  // Set de nombres normalizados de municipios pertenecientes a la
  // provincia enfocada. Necesario para filtrar la lista del panel,
  // porque el endpoint /resultados/por-municipio devuelve TODOS los
  // municipios del depto sin distinguir provincia.
  const nombresMunicipiosDeProvincia = useMemo<Set<string> | null>(() => {
    if (!geoMunicipiosFiltrado) return null;
    const s = new Set<string>();
    for (const f of geoMunicipiosFiltrado.features) {
      const nombre = String(f.properties?.NAME_3 ?? '');
      if (nombre) s.add(normalizar(nombre));
    }
    return s;
  }, [geoMunicipiosFiltrado]);

  // Centro geográfico del territorio enfocado (depto o provincia). Se
  // pasa al MapZoomController para interpolar el centro del viewport.
  const targetCenter = useMemo<[number, number] | null>(() => {
    if (nivel.modo === 'nacional') return null;
    let geo: FeatureCollection | null = null;
    if (nivel.modo === 'departamento') {
      // Bounds del depto = bounds de sus provincias dissolved
      geo = geoProvinciasFiltrado;
    } else {
      geo = geoMunicipiosFiltrado;
    }
    if (!geo || geo.features.length === 0) return null;
    const layer = L.geoJSON(geo);
    const bounds = layer.getBounds();
    if (!bounds.isValid()) return null;
    const c = bounds.getCenter();
    return [c.lat, c.lng];
  }, [nivel, geoProvinciasFiltrado, geoMunicipiosFiltrado]);

  // ─────────────────────────────────────────────────────────────────
  // Estilos por capa
  // ─────────────────────────────────────────────────────────────────

  // Capa de DEPTOS:
  // - Si nivel='nacional': capa activa, color por ganador, clickeable.
  // - Si nivel='depto'/'provincia': capa de contexto, gris claro, no
  //   clickeable. El depto enfocado queda visualmente "tapado" por la
  //   capa de provincias encima.
  const styleDepto = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
      if (!feature) return { fillColor: COLOR_SIN_DATOS, weight: 1, color: '#000', fillOpacity: 0.2 };
      const nombre = String(feature.properties?.NOM_DEP ?? '');
      const norm = normalizar(nombre);

      // En niveles más profundos, los deptos son contexto opacado.
      if (nivel.modo !== 'nacional') {
        return {
          fillColor: COLOR_CONTEXT_DEPTOS,
          fillOpacity: 0.35,
          color: COLOR_CONTEXT_STROKE,
          weight: 0.8,
          opacity: 0.7,
        };
      }

      // Nivel nacional: color por ganador, full opacidad.
      const reg = deptosByNombre.get(norm);
      const isHighlighted = highlightedKey === `dep-${norm}`;
      if (!reg || !reg.ganador) {
        return {
          fillColor: COLOR_SIN_DATOS,
          weight: isHighlighted ? 3 : 1.5,
          color: isHighlighted ? COLOR_HIGHLIGHT_STROKE : '#000',
          fillOpacity: 0.4,
          opacity: 1,
        };
      }
      return {
        fillColor: reg.ganador.color_hex,
        weight: isHighlighted ? 3 : 1.5,
        color: isHighlighted ? COLOR_HIGHLIGHT_STROKE : '#000',
        fillOpacity: calcularOpacidad(calcularMargen(reg)),
        opacity: 1,
      };
    },
    [nivel, deptosByNombre, highlightedKey],
  );

  // Capa de PROVINCIAS (solo cuando hay depto enfocado):
  // - Si nivel='depto': capa activa, color por ganador, clickeable.
  // - Si nivel='provincia': capa de contexto provincia-medio. La
  //   provincia enfocada queda tapada por sus municipios encima.
  const styleProvincia = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
      if (!feature) return { fillColor: COLOR_SIN_DATOS, weight: 1, color: '#000', fillOpacity: 0.2 };
      const nombre = String(feature.properties?.nombre ?? '');
      const norm = normalizar(nombre);

      if (nivel.modo === 'provincia') {
        return {
          fillColor: COLOR_CONTEXT_PROVS,
          fillOpacity: 0.35,
          color: COLOR_CONTEXT_STROKE,
          weight: 0.7,
          opacity: 0.8,
        };
      }

      // Nivel departamento: capa activa.
      const reg = provinciasByNombre.get(norm);
      const isHighlighted = highlightedKey === `prov-${norm}`;
      if (!reg || !reg.ganador) {
        return {
          fillColor: COLOR_SIN_DATOS,
          weight: isHighlighted ? 3 : 1,
          color: isHighlighted ? COLOR_HIGHLIGHT_STROKE : '#000',
          fillOpacity: 0.4,
          opacity: 1,
        };
      }
      return {
        fillColor: reg.ganador.color_hex,
        weight: isHighlighted ? 3 : 1,
        color: isHighlighted ? COLOR_HIGHLIGHT_STROKE : '#000',
        fillOpacity: calcularOpacidad(calcularMargen(reg)),
        opacity: 1,
      };
    },
    [nivel, provinciasByNombre, highlightedKey],
  );

  // Capa de MUNICIPIOS (solo nivel='provincia'): siempre activa, color
  // por ganador, clickeable.
  const styleMunicipio = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>): PathOptions => {
      if (!feature) return { fillColor: COLOR_SIN_DATOS, weight: 1, color: '#000', fillOpacity: 0.2 };
      const nombre = String(feature.properties?.NAME_3 ?? '');
      const norm = normalizar(nombre);
      const reg = municipiosByNombre.get(norm);
      const isHighlighted = highlightedKey === `muni-${norm}`;
      if (!reg || !reg.ganador) {
        return {
          fillColor: COLOR_SIN_DATOS,
          weight: isHighlighted ? 3 : 1,
          color: isHighlighted ? COLOR_HIGHLIGHT_STROKE : '#000',
          fillOpacity: 0.4,
          opacity: 1,
        };
      }
      return {
        fillColor: reg.ganador.color_hex,
        weight: isHighlighted ? 3 : 1,
        color: isHighlighted ? COLOR_HIGHLIGHT_STROKE : '#000',
        fillOpacity: calcularOpacidad(calcularMargen(reg)),
        opacity: 1,
      };
    },
    [municipiosByNombre, highlightedKey],
  );

  const cerrarDetalle = useCallback(() => {
    setDetalle(null);
    setDetalleNivel(null);
    setDetallePayload(null);
    setHighlightedKey(null);
  }, []);

  const abrirDetalleDepto = useCallback((depto: DepartamentoResultados) => {
    setDetalleNivel('depto');
    setDetallePayload(depto);
    setHighlightedKey(`dep-${normalizar(depto.nombre_departamento)}`);
    setDetalle({
      nombre: depto.nombre_departamento,
      contexto: 'Departamento · Bolivia',
      totalMesas: depto.total_mesas_depto,
      actasValidadas: depto.actas_validadas_depto,
      porcentajeAvance: depto.porcentaje_avance_depto,
      ganador: depto.ganador,
      resultadosCandidatos: depto.resultados_candidatos,
      drillDownLabel: 'Ver provincias',
    });
  }, []);

  const abrirDetalleProvincia = useCallback(
    (prov: ProvinciaResultados, nombreDepto: string) => {
      setDetalleNivel('provincia');
      setDetallePayload(prov);
      setHighlightedKey(`prov-${normalizar(prov.nombre_provincia)}`);
      setDetalle({
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

  const abrirDetalleMunicipio = useCallback(
    (muni: MunicipioResultados, nombreProv: string, nombreDepto: string) => {
      setDetalleNivel('municipio');
      setDetallePayload(muni);
      setHighlightedKey(`muni-${normalizar(muni.nombre_municipio)}`);
      setDetalle({
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
    if (detalleNivel === 'depto' && detallePayload) {
      const depto = detallePayload as DepartamentoResultados;
      setNivel({
        modo: 'departamento',
        codDepto: depto.id_departamento,
        nombreDepto: depto.nombre_departamento,
      });
    } else if (
      detalleNivel === 'provincia' &&
      detallePayload &&
      nivel.modo !== 'nacional'
    ) {
      const prov = detallePayload as ProvinciaResultados;
      setNivel({
        modo: 'provincia',
        codDepto: nivel.codDepto,
        nombreDepto: nivel.nombreDepto,
        codProvincia: prov.codigo_provincia,
        nombreProvincia: prov.nombre_provincia,
      });
    }
    cerrarDetalle();
  }, [detalleNivel, detallePayload, nivel, cerrarDetalle]);

  // onEachFeature por capa. Solo la capa "activa" del nivel actual tiene
  // handlers (click + hover); las capas de contexto son visuales nada más.

  const onEachDepto = useCallback(
    (feature: Feature, layer: Layer): void => {
      const nombre = String(feature.properties?.NOM_DEP ?? '');
      const depto = deptosByNombre.get(normalizar(nombre));
      const tooltip = depto?.ganador
        ? `<strong>${nombre}</strong><br/>` +
          `Ganador: ${depto.ganador.sigla_partido} (${depto.ganador.porcentaje.toFixed(1)}%)<br/>` +
          `Avance: ${depto.actas_validadas_depto}/${depto.total_mesas_depto} ` +
          `(${depto.porcentaje_avance_depto.toFixed(1)}%)`
        : `<strong>${nombre}</strong><br/>Sin actas procesadas`;
      layer.bindTooltip(tooltip, { sticky: true, direction: 'top' });
      layer.on({
        click: () => {
          if (!depto) return;
          // En nivel nacional → abrir detalle
          // En niveles más profundos → cambiar al depto clickeado
          // (incluye click en el depto actual, que pasa a nivel
          // 'departamento' descartando la provincia activa).
          if (nivel.modo === 'nacional') {
            abrirDetalleDepto(depto);
          } else {
            cerrarDetalle();
            setNivel({
              modo: 'departamento',
              codDepto: depto.id_departamento,
              nombreDepto: depto.nombre_departamento,
            });
          }
        },
        mouseover: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({ weight: 3, color: '#1A2332' });
        },
        mouseout: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({
            weight: nivel.modo === 'nacional' ? 1.5 : 0.8,
            color: nivel.modo === 'nacional' ? '#000' : COLOR_CONTEXT_STROKE,
          });
        },
      });
    },
    [nivel, deptosByNombre, abrirDetalleDepto, cerrarDetalle],
  );

  const onEachProvincia = useCallback(
    (feature: Feature, layer: Layer): void => {
      if (nivel.modo === 'nacional') return;
      const nombre = String(feature.properties?.nombre ?? '');
      const prov = provinciasByNombre.get(normalizar(nombre));
      const tooltip = prov?.ganador
        ? `<strong>${nombre}</strong><br/>` +
          `Ganador: ${prov.ganador.sigla_partido} (${prov.ganador.porcentaje.toFixed(1)}%)<br/>` +
          `Avance: ${prov.actas_validadas_provincia}/${prov.total_mesas_provincia} ` +
          `(${prov.porcentaje_avance_provincia.toFixed(1)}%)`
        : `<strong>${nombre}</strong><br/>Sin actas procesadas`;
      layer.bindTooltip(tooltip, { sticky: true, direction: 'center' });
      layer.on({
        click: () => {
          if (!prov) return;
          if (nivel.modo === 'departamento') {
            abrirDetalleProvincia(prov, nivel.nombreDepto);
          } else if (nivel.modo === 'provincia') {
            // Cambiar a la provincia clickeada (ya estamos en nivel
            // provincia, las otras provincias del mismo depto siguen
            // visibles como contexto y son clickeables).
            cerrarDetalle();
            setNivel({
              modo: 'provincia',
              codDepto: nivel.codDepto,
              nombreDepto: nivel.nombreDepto,
              codProvincia: prov.codigo_provincia,
              nombreProvincia: prov.nombre_provincia,
            });
          }
        },
        mouseover: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({ weight: 3, color: '#1A2332' });
        },
        mouseout: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({
            weight: nivel.modo === 'departamento' ? 1 : 0.7,
            color: nivel.modo === 'departamento' ? '#000' : COLOR_CONTEXT_STROKE,
          });
        },
      });
    },
    [nivel, provinciasByNombre, abrirDetalleProvincia, cerrarDetalle],
  );

  const onEachMunicipio = useCallback(
    (feature: Feature, layer: Layer): void => {
      if (nivel.modo !== 'provincia') return;
      const nombre = String(feature.properties?.NAME_3 ?? '');
      const muni = municipiosByNombre.get(normalizar(nombre));
      const tooltip = muni?.ganador
        ? `<strong>${nombre}</strong><br/>` +
          `Ganador: ${muni.ganador.sigla_partido} (${muni.ganador.porcentaje.toFixed(1)}%)<br/>` +
          `Avance: ${muni.actas_validadas_municipio}/${muni.total_mesas_municipio} ` +
          `(${muni.porcentaje_avance_municipio.toFixed(1)}%)`
        : `<strong>${nombre}</strong><br/>Sin actas procesadas`;
      layer.bindTooltip(tooltip, { sticky: true, direction: 'center' });
      layer.on({
        click: () => {
          if (muni && nivel.modo === 'provincia')
            abrirDetalleMunicipio(muni, nivel.nombreProvincia, nivel.nombreDepto);
        },
        mouseover: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({ weight: 3, color: '#1A2332' });
        },
        mouseout: (e: LeafletMouseEvent) => {
          const path = e.target as { setStyle?: (s: PathOptions) => void };
          path.setStyle?.({ weight: 1, color: '#000' });
        },
      });
    },
    [nivel, municipiosByNombre, abrirDetalleMunicipio],
  );

  const cargandoNivel =
    loadingGeoDeptos ||
    !deptosResp ||
    (nivel.modo !== 'nacional' && (loadingGeoProvincias || !provinciasResp)) ||
    (nivel.modo === 'provincia' && (loadingGeoMunicipios || !municipiosResp));

  // Items de la lista del panel lateral según nivel.
  const itemsLista = useMemo<ItemListaTerritorio[]>(() => {
    if (nivel.modo === 'nacional' && deptosResp) {
      return deptosResp.departamentos.map((d) => ({
        id: `dep-${d.id_departamento}`,
        nombre: d.nombre_departamento,
        ganador: d.ganador,
        porcentajeAvance: d.porcentaje_avance_depto,
        actasValidadas: d.actas_validadas_depto,
        totalMesas: d.total_mesas_depto,
      }));
    }
    if (nivel.modo === 'departamento' && provinciasResp) {
      return provinciasResp.provincias.map((p) => ({
        id: `prov-${p.codigo_provincia}`,
        nombre: p.nombre_provincia,
        ganador: p.ganador,
        porcentajeAvance: p.porcentaje_avance_provincia,
        actasValidadas: p.actas_validadas_provincia,
        totalMesas: p.total_mesas_provincia,
      }));
    }
    if (nivel.modo === 'provincia' && municipiosResp) {
      // El endpoint /por-municipio devuelve TODOS los municipios del depto.
      // Cruzamos con el set derivado del GeoJSON filtrado por (depto, provincia)
      // para mostrar solo los de la provincia enfocada.
      return municipiosResp.municipios
        .filter((m) => {
          if (!nombresMunicipiosDeProvincia) return false;
          return nombresMunicipiosDeProvincia.has(normalizar(m.nombre_municipio));
        })
        .map((m) => ({
          id: `muni-${m.codigo_municipio}`,
          nombre: m.nombre_municipio,
          ganador: m.ganador,
          porcentajeAvance: m.porcentaje_avance_municipio,
          actasValidadas: m.actas_validadas_municipio,
          totalMesas: m.total_mesas_municipio,
        }));
    }
    return [];
  }, [nivel, deptosResp, provinciasResp, municipiosResp, nombresMunicipiosDeProvincia]);

  const handleSelectItemLista = useCallback(
    (id: string) => {
      if (nivel.modo === 'nacional' && deptosResp) {
        const codDepto = Number(id.replace('dep-', ''));
        const depto = deptosResp.departamentos.find(
          (d) => d.id_departamento === codDepto,
        );
        if (depto) abrirDetalleDepto(depto);
      } else if (nivel.modo === 'departamento' && provinciasResp) {
        const codProv = id.replace('prov-', '');
        const prov = provinciasResp.provincias.find(
          (p) => p.codigo_provincia === codProv,
        );
        if (prov) abrirDetalleProvincia(prov, nivel.nombreDepto);
      } else if (nivel.modo === 'provincia' && municipiosResp) {
        const codMuni = id.replace('muni-', '');
        const muni = municipiosResp.municipios.find(
          (m) => m.codigo_municipio === codMuni,
        );
        if (muni)
          abrirDetalleMunicipio(muni, nivel.nombreProvincia, nivel.nombreDepto);
      }
    },
    [
      nivel,
      deptosResp,
      provinciasResp,
      municipiosResp,
      abrirDetalleDepto,
      abrirDetalleProvincia,
      abrirDetalleMunicipio,
    ],
  );

  const nivelLabel =
    nivel.modo === 'nacional'
      ? 'Departamentos'
      : nivel.modo === 'departamento'
        ? `Provincias de ${nivel.nombreDepto}`
        : `Municipios de ${nivel.nombreProvincia}`;
  const contextoLabel =
    nivel.modo === 'nacional'
      ? 'Bolivia · Nivel nacional'
      : nivel.modo === 'departamento'
        ? `${nivel.nombreDepto} · Bolivia`
        : `${nivel.nombreProvincia} · ${nivel.nombreDepto}`;

  const handleBreadcrumbBolivia = useCallback(() => {
    cerrarDetalle();
    setNivel({ modo: 'nacional' });
  }, [cerrarDetalle]);

  const handleBreadcrumbDepto = useCallback(() => {
    if (nivel.modo === 'provincia') {
      cerrarDetalle();
      setNivel({
        modo: 'departamento',
        codDepto: nivel.codDepto,
        nombreDepto: nivel.nombreDepto,
      });
    }
  }, [nivel, cerrarDetalle]);

  return (
    <section aria-labelledby="mapa-titulo">
      <h2 id="mapa-titulo" className="text-lg font-semibold mb-1">
        Mapa Electoral de Bolivia
      </h2>
      <p className="text-sm text-oficial-text-secondary mb-4">
        Cada territorio se colorea según el partido ganador. La intensidad
        refleja el margen de victoria. Click sobre un territorio abre el
        detalle.
      </p>

      {/* Breadcrumb */}
      <nav
        aria-label="Navegación del mapa"
        className="bg-oficial-card border border-oficial-border rounded-t-lg px-4 py-2 flex items-center gap-2 text-sm"
      >
        <button
          type="button"
          onClick={handleBreadcrumbBolivia}
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
              onClick={handleBreadcrumbDepto}
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
              cerrarDetalle();
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

      <div className="bg-white border border-oficial-border border-t-0 rounded-b-lg overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Mapa: ocupa todo el ancho disponible del lado izquierdo */}
          <div className="flex-1 min-w-0 p-2">
            {cargandoNivel ? (
              <div
                className="h-[680px] bg-oficial-bg rounded animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <MapContainer
                bounds={BOLIVIA_REAL_BOUNDS}
                // En nivel nacional el mapa está fijo; en niveles más
                // profundos MapZoomController habilita drag y aplica
                // maxBounds. Zoom manual deshabilitado siempre — el
                // zoom se controla por el nivel del drill-down.
                scrollWheelZoom={false}
                zoomControl={false}
                doubleClickZoom={false}
                touchZoom={false}
                keyboard={false}
                style={{
                  height: '680px',
                  width: '100%',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                }}
              >
                <MapZoomController nivel={nivel.modo} targetCenter={targetCenter} />
                {geoDeptos && (
                  <GeoJSON
                    key={`deptos-${nivel.modo}-${highlightedKey ?? ''}-${nivel.modo === 'nacional' ? dataUpdatedAt : ''}`}
                    data={geoDeptos}
                    style={styleDepto}
                    onEachFeature={onEachDepto}
                    interactive={true}
                  />
                )}
                {geoProvinciasFiltrado && (
                  <GeoJSON
                    key={`provs-${nivel.modo}-${'codDepto' in nivel ? nivel.codDepto : ''}-${highlightedKey ?? ''}-${nivel.modo === 'departamento' ? dataUpdatedAt : ''}`}
                    data={geoProvinciasFiltrado}
                    style={styleProvincia}
                    onEachFeature={onEachProvincia}
                    interactive={true}
                  />
                )}
                {geoMunicipiosFiltrado && (
                  <GeoJSON
                    key={`munis-${'codProvincia' in nivel ? nivel.codProvincia : ''}-${highlightedKey ?? ''}-${dataUpdatedAt}`}
                    data={geoMunicipiosFiltrado}
                    style={styleMunicipio}
                    onEachFeature={onEachMunicipio}
                  />
                )}
              </MapContainer>
            )}
            <Leyenda partidos={partidosMeta} />
          </div>

          {/* Panel lateral: lista del nivel actual, o detalle al click */}
          <PanelLateralMapa
            nivelLabel={nivelLabel}
            contextoLabel={contextoLabel}
            itemsLista={itemsLista}
            detalle={detalle}
            partidosMeta={partidosMeta}
            onSelectItem={handleSelectItemLista}
            onCerrarDetalle={cerrarDetalle}
            onDrillDown={detalle?.drillDownLabel ? handleDrillDown : undefined}
          />
        </div>
      </div>
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
