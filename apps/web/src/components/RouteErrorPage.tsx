import { Link } from 'react-router';
import { es } from '../i18n/es';
import { Button, buttonClasses } from './ui/Button';

/**
 * `errorElement` de la raiz: si una pantalla falla al pintarse se ve esto, en vez de la pagina por
 * defecto de React Router (en ingles y con detalles tecnicos).
 */
export function RouteErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{es.crash.title}</h1>
      <p className="text-fg-muted">{es.crash.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>{es.crash.reload}</Button>
        <Link to="/" className={buttonClasses('secondary')}>
          {es.notFound.goHome}
        </Link>
      </div>
    </main>
  );
}
