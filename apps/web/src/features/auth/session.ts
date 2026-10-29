import { MutationCache, QueryCache, QueryClient, type DefaultOptions } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { ME_QUERY_KEY } from './useMe';

const MAX_RETRIES = 3;

/** Descarta todo lo cacheado de la persona y marca que no hay sesion (`RequireAuth` lleva a `/entrar`). */
export function clearSession(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
  queryClient.setQueryData(ME_QUERY_KEY, null);
}

/** Un 4xx no se arregla reintentando (y con un 401 retrasaria varios segundos la salida). */
const retryUnlessClientError = (failureCount: number, error: unknown) =>
  !(error instanceof ApiError && error.status < 500) && failureCount < MAX_RETRIES;

/**
 * Cliente de TanStack Query de la app. Si cualquier peticion responde 401 (la sesion caduco o se
 * cerro en otro dispositivo), se descarta la sesion en vez de mostrar errores de carga sueltos.
 */
export function createQueryClient(defaultOptions: DefaultOptions = {}) {
  const onError = (error: unknown) => {
    // Solo si habia sesion: en `/entrar` un 401 significa "credenciales incorrectas".
    const hadSession = Boolean(queryClient.getQueryData(ME_QUERY_KEY));
    if (error instanceof ApiError && error.status === 401 && hadSession) clearSession(queryClient);
  };
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      ...defaultOptions,
      queries: { retry: retryUnlessClientError, ...defaultOptions.queries },
    },
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });
  return queryClient;
}
