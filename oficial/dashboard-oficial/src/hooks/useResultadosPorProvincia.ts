import { useQuery } from '@tanstack/react-query';
import { getResultadosPorProvincia } from '../api/endpoints';

export function useResultadosPorProvincia(
  codigoDepartamento: number | null,
) {
  return useQuery({
    queryKey: ['resultados-por-provincia', codigoDepartamento],
    queryFn: () => getResultadosPorProvincia(codigoDepartamento as number),
    enabled: codigoDepartamento !== null,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}
