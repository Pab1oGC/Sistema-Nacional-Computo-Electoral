import { useQuery } from '@tanstack/react-query';
import { getResultadosPorDepartamento } from '../api/endpoints';

export function useResultadosPorDepto() {
  return useQuery({
    queryKey: ['resultados-por-depto'],
    queryFn: getResultadosPorDepartamento,
    refetchInterval: 10000,
  });
}
