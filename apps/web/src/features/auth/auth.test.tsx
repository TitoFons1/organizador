import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA_ME, HEALTH_OK, mockApi, sentBodies, UNAUTHORIZED } from '../../test/mock-api';
import { renderApp } from '../../test/render';

/** API falsa con sesion: `/me` responde 401 hasta que se llama a sign-in/sign-up. */
function sessionApi(extra: Parameters<typeof mockApi>[0] = {}) {
  let signedIn = false;
  return mockApi({
    'GET /api/v1/me': () => (signedIn ? { body: ANA_ME } : UNAUTHORIZED),
    'GET /api/v1/health': { body: HEALTH_OK },
    'POST /api/v1/auth/sign-in/email': () => {
      signedIn = true;
      return { body: { token: 't' } };
    },
    'POST /api/v1/auth/sign-up/email': () => {
      signedIn = true;
      return { body: { token: 't' } };
    },
    'POST /api/v1/auth/sign-out': () => {
      signedIn = false;
      return { body: { success: true } };
    },
    ...extra,
  });
}

describe('entrar', () => {
  it('inicia sesion y lleva al panel', async () => {
    const api = sessionApi();
    const user = userEvent.setup();
    renderApp('/entrar');

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
    expect(sentBodies(api, 'POST', '/api/v1/auth/sign-in/email')).toEqual([
      { email: 'ana@example.com', password: 'contrasena-de-ana' },
    ]);
  });

  it('muestra un error en espanol si las credenciales son incorrectas', async () => {
    sessionApi({
      'POST /api/v1/auth/sign-in/email': {
        status: 401,
        body: { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' },
      },
    });
    const user = userEvent.setup();
    renderApp('/entrar');

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El email o la contraseña no son correctos.',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  });

  it('avisa de demasiados intentos (429)', async () => {
    sessionApi({
      'POST /api/v1/auth/sign-in/email': {
        status: 429,
        body: { statusCode: 429, message: 'Demasiados intentos. Espera un momento.' },
      },
    });
    const user = userEvent.setup();
    renderApp('/entrar');

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos');
  });

  it('valida el formulario antes de llamar al servidor', async () => {
    const api = sessionApi();
    const user = userEvent.setup();
    renderApp('/entrar');

    await user.type(await screen.findByLabelText('Email'), 'no-es-un-email');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Escribe un email válido.')).toBeInTheDocument();
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(sentBodies(api, 'POST', '/api/v1/auth/sign-in/email')).toEqual([]);
  });

  it('vuelve a la pagina que se pedia antes de identificarse', async () => {
    sessionApi();
    const user = userEvent.setup();
    renderApp('/asignaturas');

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Asignaturas' }),
    ).toBeInTheDocument();
  });

  it('ignora una redireccion hacia otro sitio y entra por la raiz', async () => {
    sessionApi();
    const user = userEvent.setup();
    const { router } = renderApp({ pathname: '/entrar', state: { from: '//evil.example/x' } });

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await screen.findByRole('heading', { level: 1, name: 'Panel' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('si ya hay sesion, /entrar redirige al panel', async () => {
    mockApi({
      'GET /api/v1/me': { body: ANA_ME },
      'GET /api/v1/health': { body: HEALTH_OK },
    });
    renderApp('/entrar');

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
  });
});

describe('crear cuenta', () => {
  it('registra y entra directamente al panel', async () => {
    const api = sessionApi();
    const user = userEvent.setup();
    renderApp('/registro');

    await user.type(await screen.findByLabelText('Nombre'), '  Ana ');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeInTheDocument();
    // El nombre se envia ya recortado.
    expect(sentBodies(api, 'POST', '/api/v1/auth/sign-up/email')).toEqual([
      { name: 'Ana', email: 'ana@example.com', password: 'contrasena-de-ana' },
    ]);
  });

  it('exige la longitud minima de la contraseña y la explica', async () => {
    const api = sessionApi();
    const user = userEvent.setup();
    renderApp('/registro');

    expect(await screen.findByText('Mínimo 8 caracteres.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(sentBodies(api, 'POST', '/api/v1/auth/sign-up/email')).toEqual([]);
  });

  it('informa de que el registro esta cerrado', async () => {
    sessionApi({
      'POST /api/v1/auth/sign-up/email': {
        status: 400,
        body: { message: 'sign up disabled', code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED' },
      },
    });
    const user = userEvent.setup();
    renderApp('/registro');

    await user.type(await screen.findByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El registro está cerrado');
  });

  it('informa de que el email ya existe', async () => {
    sessionApi({
      'POST /api/v1/auth/sign-up/email': {
        status: 422,
        body: { message: 'exists', code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
      },
    });
    const user = userEvent.setup();
    renderApp('/registro');

    await user.type(await screen.findByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta');
  });
});

describe('cerrar sesion', () => {
  it('cierra la sesion, vuelve a la entrada y descarta los datos en cache', async () => {
    const api = sessionApi();
    const user = userEvent.setup();
    const { client } = renderApp('/entrar');

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'contrasena-de-ana');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { level: 1, name: 'Panel' });
    await screen.findByText('Conectado');
    expect(client.getQueryData(['health'])).toBeDefined();

    await user.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    await waitFor(() => expect(client.getQueryData(['health'])).toBeUndefined());
    expect(sentBodies(api, 'POST', '/api/v1/auth/sign-out')).toHaveLength(1);
  });
});
