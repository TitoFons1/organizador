import { useSyncExternalStore } from 'react';

/** Punto de corte `md` de Tailwind: a partir de aqui se usa el diseno de escritorio. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * `true` si la consulta CSS se cumple, y se actualiza al cambiar el tamano. Sin `matchMedia`
 * (jsdom en los tests) se toma el diseno movil, que es el de referencia (mobile-first).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
}

export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);
