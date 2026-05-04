import { apiClient } from './client';
import type {
  AvanceResponse,
  EstadoReplicacionResponse,
  HealthResponse,
  ListaInconsistenciasResponse,
  ResultadosPorDepartamentoResponse,
  ResultadosResponse,
} from '../types/api';

export async function getResultados(): Promise<ResultadosResponse> {
  const { data } = await apiClient.get<ResultadosResponse>(
    '/api/v1/oficial/resultados',
  );
  return data;
}

export async function getAvance(): Promise<AvanceResponse> {
  const { data } = await apiClient.get<AvanceResponse>('/api/v1/oficial/avance');
  return data;
}

export async function getResultadosPorDepartamento(): Promise<ResultadosPorDepartamentoResponse> {
  const { data } = await apiClient.get<ResultadosPorDepartamentoResponse>(
    '/api/v1/oficial/resultados/por-departamento',
  );
  return data;
}

export async function getInconsistenciasPorTipo(
  tipo: string,
): Promise<ListaInconsistenciasResponse> {
  // limit=1: solo nos interesa el campo `total` para el panel agregado;
  // no descargamos los items completos para esto.
  const { data } = await apiClient.get<ListaInconsistenciasResponse>(
    '/api/v1/oficial/inconsistencias',
    { params: { tipo, limit: 1 } },
  );
  return data;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
}

export async function getReplicacionEstado(): Promise<EstadoReplicacionResponse> {
  const { data } = await apiClient.get<EstadoReplicacionResponse>(
    '/api/v1/oficial/replicacion/estado',
  );
  return data;
}
