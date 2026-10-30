import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router';
import { NotFoundPage } from './components/NotFoundPage';
import { PagePlaceholder } from './components/PagePlaceholder';
import { RouteErrorPage } from './components/RouteErrorPage';
import { MorePage } from './features/account/MorePage';
import { GuestOnly, RequireAuth } from './features/auth/guards';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { createQueryClient } from './features/auth/session';
import { CalendarPage } from './features/calendar/CalendarPage';
import { PanelPage } from './features/panel/PanelPage';
import { SlotsPage } from './features/schedule/SlotsPage';
import { TaskFormPage } from './features/tasks/TaskFormPage';
import { DeleteSubjectPage } from './features/subjects/DeleteSubjectPage';
import { SubjectFormPage } from './features/subjects/SubjectFormPage';
import { SubjectsPage } from './features/subjects/SubjectsPage';
import { TrashPage } from './features/trash/TrashPage';
import { es } from './i18n/es';
import { AppShell } from './layouts/AppShell';

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
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
              { index: true, element: <PanelPage /> },
              { path: 'calendario', element: <CalendarPage /> },
              { path: 'asignaturas', element: <SubjectsPage /> },
              { path: 'asignaturas/nueva', element: <SubjectFormPage /> },
              { path: 'asignaturas/:id/editar', element: <SubjectFormPage /> },
              { path: 'asignaturas/:id/eliminar', element: <DeleteSubjectPage /> },
              { path: 'asignaturas/:id/horario', element: <SlotsPage /> },
              { path: 'pendientes/nueva', element: <TaskFormPage /> },
              { path: 'pendientes/:id', element: <TaskFormPage /> },
              { path: 'papelera', element: <TrashPage /> },
              { path: 'notas', element: <PagePlaceholder title={es.nav.notes} milestone="M7" /> },
              { path: 'mas', element: <MorePage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

const queryClient = createQueryClient({
  queries: { staleTime: 30_000, refetchOnWindowFocus: true },
});
const router = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
