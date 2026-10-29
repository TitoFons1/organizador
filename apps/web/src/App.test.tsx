import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
