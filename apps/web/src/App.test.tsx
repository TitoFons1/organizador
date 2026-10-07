import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from './App';

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('AppShell', () => {
  it('muestra el panel y el estado del servidor cuando la API responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', db: 'up', time: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
    expect(await screen.findByText('Conectado')).toBeInTheDocument();
  });

  it('avisa si no se puede contactar con la API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));

    renderApp();

    expect(await screen.findByText('No se puede contactar con el servidor')).toBeInTheDocument();
  });

  it('navega entre secciones con la barra de navegacion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    const user = userEvent.setup();

    renderApp();
    // Hay dos barras (lateral y movil); ambas existen en el DOM, solo una se ve segun el ancho.
    const [firstLink] = screen.getAllByRole('link', { name: 'Asignaturas' });
    await user.click(firstLink!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Asignaturas' })).toBeVisible();
  });
});
