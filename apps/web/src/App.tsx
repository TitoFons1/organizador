import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router';
import { PagePlaceholder } from './components/PagePlaceholder';
import { MorePage } from './features/account/MorePage';
import { GuestOnly, RequireAuth } from './features/auth/guards';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ServerStatus } from './features/health/ServerStatus';
import { DeleteSubjectPage } from './features/subjects/DeleteSubjectPage';
import { SubjectFormPage } from './features/subjects/SubjectFormPage';
import { SubjectsPage } from './features/subjects/SubjectsPage';
import { TrashPage } from './features/trash/TrashPage';
import { es } from './i18n/es';
import { AppShell } from './layouts/AppShell';

export const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      { path: 'entrar', element: <LoginPage /> },
      { path: 'registro', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
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
          { path: 'asignaturas', element: <SubjectsPage /> },
          { path: 'asignaturas/nueva', element: <SubjectFormPage /> },
          { path: 'asignaturas/:id/editar', element: <SubjectFormPage /> },
          { path: 'asignaturas/:id/eliminar', element: <DeleteSubjectPage /> },
          { path: 'papelera', element: <TrashPage /> },
          { path: 'notas', element: <PagePlaceholder title={es.nav.notes} milestone="M7" /> },
          { path: 'mas', element: <MorePage /> },
        ],
      },
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
