import { useQuery } from '@tanstack/react-query';
import { getResultadosPorMunicipio } from '../api/endpoints';

export function useResultadosPorMunicipio(codigoDepartamento: number | null) {
  return useQuery({
    queryKey: ['resultados-por-municipio', codigoDepartamento],
    queryFn: () => getResultadosPorMunicipio(codigoDepartamento as number),
    enabled: codigoDepartamento !== null,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}
