import { useQuery } from '@tanstack/react-query';
import { fetchMe } from './auth-api';

export const ME_QUERY_KEY = ['me'] as const;

/** Sesion actual: `data` es `null` si no hay sesion, y `undefined` mientras carga. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });
}
