import { useQuery } from '@tanstack/react-query';
import { getAvance } from '../api/endpoints';

export function useAvance() {
  return useQuery({
    queryKey: ['avance'],
    queryFn: getAvance,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}
