import { Link } from 'react-router';
import { es } from '../i18n/es';
import { buttonClasses } from './ui/Button';

/** Ruta desconocida dentro de la app: se pinta con la navegacion para poder seguir. */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">{es.notFound.title}</h1>
      <p className="text-fg-muted">{es.notFound.text}</p>
      <Link to="/" className={buttonClasses('secondary')}>
        {es.notFound.goHome}
      </Link>
    </div>
  );
}
