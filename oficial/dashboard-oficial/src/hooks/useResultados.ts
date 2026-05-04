import { useQuery } from '@tanstack/react-query';
import { getResultados } from '../api/endpoints';

export function useResultados() {
  return useQuery({
    queryKey: ['resultados'],
    queryFn: getResultados,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}
