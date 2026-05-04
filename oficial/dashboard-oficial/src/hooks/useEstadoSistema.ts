import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/endpoints';

export function useEstadoSistema() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 15000,
  });
}
