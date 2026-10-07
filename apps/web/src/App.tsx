import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router';
import { PagePlaceholder } from './components/PagePlaceholder';
import { ServerStatus } from './features/health/ServerStatus';
import { es } from './i18n/es';
import { AppShell } from './layouts/AppShell';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <PagePlaceholder title={es.nav.panel} milestone="M6">
            <ServerStatus />
          </PagePlaceholder>
        ),
      },
      {
        path: 'calendario',
        element: <PagePlaceholder title={es.nav.calendar} milestone="M3" />,
      },
      {
        path: 'asignaturas',
        element: <PagePlaceholder title={es.nav.subjects} milestone="M2" />,
      },
      { path: 'notas', element: <PagePlaceholder title={es.nav.notes} milestone="M7" /> },
      { path: 'mas', element: <PagePlaceholder title={es.nav.more} milestone="M7" /> },
    ],
  },
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
});
const router = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
