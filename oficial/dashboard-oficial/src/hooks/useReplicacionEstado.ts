import { useQuery } from '@tanstack/react-query';
import { getReplicacionEstado } from '../api/endpoints';

export function useReplicacionEstado() {
  return useQuery({
    queryKey: ['replicacion-estado'],
    queryFn: getReplicacionEstado,
    refetchInterval: 15000,
  });
}
