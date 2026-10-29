import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { redirectTarget } from './redirect';
import { useMe } from './useMe';

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center text-fg-muted">
      {children}
    </main>
  );
}

/** Layout de las rutas privadas: sin sesion lleva a `/entrar` recordando a donde ibas. */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <FullScreenMessage>{es.common.loading}</FullScreenMessage>;
  if (me.isError) {
    return (
      <FullScreenMessage>
        <p>{es.common.serverError}</p>
        <Button variant="secondary" onClick={() => void me.refetch()}>
          {es.common.retry}
        </Button>
      </FullScreenMessage>
    );
  }
  if (me.data === null) {
    return (
      <Navigate to="/entrar" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  return <Outlet />;
}

/**
 * Layout de `/entrar` y `/registro`: si ya hay sesion no tiene sentido verlas. Es el unico punto
 * que redirige tras identificarse (a la pagina que se pedia, o al panel), asi no compite con las
 * paginas de login/registro, que solo dejan la sesion cargada en cache.
 */
export function GuestOnly() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <FullScreenMessage>{es.common.loading}</FullScreenMessage>;
  if (me.data) return <Navigate to={redirectTarget(location.state)} replace />;
  return <Outlet />;
}
