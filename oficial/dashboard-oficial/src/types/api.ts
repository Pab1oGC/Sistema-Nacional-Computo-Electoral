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
