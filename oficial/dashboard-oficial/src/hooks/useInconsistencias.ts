import { useQueries } from '@tanstack/react-query';
import { getInconsistenciasPorTipo } from '../api/endpoints';

const TIPOS = ['ERROR1', 'ERROR2', 'ERROR3', 'ERROR4'] as const;

export interface InconsistenciasResumen {
  /** ERROR1 + ERROR2: validaciones aritméticas (papeletas, votos). */
  errorAritmetico: number;
  /** ERROR3: codigo_mesa no existe en el catálogo OEP. */
  errorMesaInexistente: number;
  /** ERROR4: idempotencia, acta ya procesada. */
  errorDuplicado: number;
  /** Suma total de las 4 categorías. */
  totalObservadas: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Agrega los conteos de los 4 tipos de inconsistencias en paralelo.
 * Útil mientras no exista un endpoint dedicado /inconsistencias/conteo.
 * Cuando ese endpoint exista, este hook se reemplaza por una sola query.
 */
export function useInconsistencias(): InconsistenciasResumen {
  const queries = useQueries({
    queries: TIPOS.map((tipo) => ({
      queryKey: ['inconsistencias', tipo],
      queryFn: () => getInconsistenciasPorTipo(tipo),
      refetchInterval: 15000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const totalPorTipo = queries.map((q) => q.data?.total ?? 0);
  const error1 = totalPorTipo[0] ?? 0;
  const error2 = totalPorTipo[1] ?? 0;
  const error3 = totalPorTipo[2] ?? 0;
  const error4 = totalPorTipo[3] ?? 0;

  return {
    errorAritmetico: error1 + error2,
    errorMesaInexistente: error3,
    errorDuplicado: error4,
    totalObservadas: error1 + error2 + error3 + error4,
    isLoading,
    isError,
  };
}
