// Tipos TypeScript que reflejan las respuestas Pydantic del backend.
// Mantener sincronizados con backend/src/recuento_oficial/presentation/schemas/.

// ─── /resultados ──────────────────────────────────────────────

export interface CandidatoResultado {
  candidato_id: number;
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
  orden_papeleta: number;
  votos_total: number;
  porcentaje: number;
}

export interface ResultadosResponse {
  total_votos_validos: number;
  total_blancos: number;
  total_nulos: number;
  candidatos: CandidatoResultado[];
}

// ─── /avance ───────────────────────────────────────────────────

export interface AvanceResponse {
  total_mesas: number;
  actas_validadas: number;
  actas_pendientes: number;
  porcentaje_avance: number;
  ultima_actualizacion: string;
}

// ─── /resultados/por-departamento ─────────────────────────────

export interface CandidatoVotosDepto {
  sigla_candidato: string;
  votos: number;
  porcentaje: number;
}

export interface GanadorDepto {
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
  votos: number;
  porcentaje: number;
}

export interface DepartamentoResultados {
  id_departamento: number;
  nombre_departamento: string;
  total_mesas_depto: number;
  actas_validadas_depto: number;
  porcentaje_avance_depto: number;
  ganador: GanadorDepto | null;
  resultados_candidatos: CandidatoVotosDepto[];
}

export interface ResultadosPorDepartamentoResponse {
  departamentos: DepartamentoResultados[];
}

// ─── /resultados/por-provincia?departamento=N ─────────────────

export interface CandidatoVotosProvincia {
  sigla_candidato: string;
  votos: number;
  porcentaje: number;
}

export interface GanadorProvincia {
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
  votos: number;
  porcentaje: number;
}

export interface ProvinciaResultados {
  codigo_provincia: string;
  nombre_provincia: string;
  total_mesas_provincia: number;
  actas_validadas_provincia: number;
  porcentaje_avance_provincia: number;
  ganador: GanadorProvincia | null;
  resultados_candidatos: CandidatoVotosProvincia[];
}

export interface ResultadosPorProvinciaResponse {
  departamento: DepartamentoBrief;
  provincias: ProvinciaResultados[];
}

// ─── /resultados/por-municipio?departamento=N ─────────────────

export interface CandidatoVotosMunicipio {
  sigla_candidato: string;
  votos: number;
  porcentaje: number;
}

export interface GanadorMunicipio {
  sigla_candidato: string;
  nombre_candidato: string;
  sigla_partido: string;
  color_hex: string;
  votos: number;
  porcentaje: number;
}

export interface MunicipioResultados {
  id_municipio: number;
  codigo_municipio: string;
  nombre_municipio: string;
  total_mesas_municipio: number;
  actas_validadas_municipio: number;
  porcentaje_avance_municipio: number;
  ganador: GanadorMunicipio | null;
  resultados_candidatos: CandidatoVotosMunicipio[];
}

export interface DepartamentoBrief {
  codigo: number;
  nombre: string;
}

export interface ResultadosPorMunicipioResponse {
  departamento: DepartamentoBrief;
  municipios: MunicipioResultados[];
}

// ─── /inconsistencias ─────────────────────────────────────────

export interface InconsistenciaItem {
  id_inconsistencia: number | null;
  codigo_acta: string;
  codigo_mesa: number;
  tipo: string;
  mensaje: string;
  valores_recibidos: Record<string, string | number>;
  timestamp: string;
  resuelto: boolean;
}

export interface ListaInconsistenciasResponse {
  total: number;
  page: number;
  limit: number;
  items: InconsistenciaItem[];
  tipo_mas_comun: string | null;
}

// ─── /health ──────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded';
  postgres: string;
}

// ─── /replicacion/estado ──────────────────────────────────────

export interface EstadoReplicacionResponse {
  master_host: string;
  replica_host: string | null;
  sync_state: string;
  state: string;
  lag_bytes: number;
  ultima_verificacion: string;
}
