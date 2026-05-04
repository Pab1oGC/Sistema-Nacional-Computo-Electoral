import { useQuery } from '@tanstack/react-query';
import { getResultadosPorDepartamento } from '../api/endpoints';

export function useResultadosPorDepto() {
  return useQuery({
    queryKey: ['resultados-por-depto'],
    queryFn: getResultadosPorDepartamento,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}
