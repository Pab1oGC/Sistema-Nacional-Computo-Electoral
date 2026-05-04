import { useQuery } from '@tanstack/react-query';
import { getAvance } from '../api/endpoints';

export function useAvance() {
  return useQuery({
    queryKey: ['avance'],
    queryFn: getAvance,
    refetchInterval: 5000,
  });
}
