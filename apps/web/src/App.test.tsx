import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from './App';
import { ANA_ME, HEALTH_OK, mockApi, UNAUTHORIZED } from './test/mock-api';
import { renderApp } from './test/render';

describe('AppShell', () => {
  it('muestra el panel y el estado del servidor cuando la API responde', async () => {
    mockApi({
      'GET /api/v1/me': { body: ANA_ME },
      'GET /api/v1/health': { body: HEALTH_OK },
    });

    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
    expect(await screen.findByText('Conectado')).toBeInTheDocument();
  });

  it('avisa si no se puede contactar con la API de salud', async () => {
    mockApi({
      'GET /api/v1/me': { body: ANA_ME },
      'GET /api/v1/health': { status: 500, body: { message: 'boom' } },
    });

    renderApp();

    expect(await screen.findByText('No se puede contactar con el servidor')).toBeInTheDocument();
  });

  it('navega entre secciones con la barra de navegacion', async () => {
    mockApi({
      'GET /api/v1/me': { body: ANA_ME },
      'GET /api/v1/health': { body: HEALTH_OK },
    });
    const user = userEvent.setup();

    renderApp();
    // Hay dos barras (lateral y movil); ambas existen en el DOM, solo una se ve segun el ancho.
    const [firstLink] = await screen.findAllByRole('link', { name: 'Asignaturas' });
    await user.click(firstLink!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Asignaturas' })).toBeVisible();
  });

  it('sin sesion lleva a la pantalla de entrada', async () => {
    mockApi({ 'GET /api/v1/me': UNAUTHORIZED });

    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel' })).not.toBeInTheDocument();
  });
});

describe('rutas desconocidas y errores', () => {
  it('una direccion que no existe muestra "Página no encontrada" con la navegacion', async () => {
    mockApi({ 'GET /api/v1/me': { body: ANA_ME } });

    renderApp('/no-existe');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Principal' }).length).toBeGreaterThan(0);
  });

  it('un fallo al pintar una pantalla muestra la pagina de error de la raiz', async () => {
    // React registra el error en consola; aqui es lo esperado.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom(): never {
      throw new Error('fallo de prueba');
    }
    const router = createMemoryRouter([
      { errorElement: routes[0]!.errorElement, children: [{ index: true, element: <Boom /> }] },
    ]);

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo ha fallado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar la página' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
