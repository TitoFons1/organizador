import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';

/**
 * Bloques grises mientras carga (docs/01, 7.5: la app nunca debe verse "en blanco"). Para los
 * lectores de pantalla es un unico "Cargando…".
 */
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">{es.common.loading}</span>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="h-12 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
