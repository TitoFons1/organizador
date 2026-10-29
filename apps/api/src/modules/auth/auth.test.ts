import { meResponseSchema } from '@organizador/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { account, membership, user, userSettings, workspace } from '../../db/schema';
import {
  ANA,
  BEA,
  createTestContext,
  get,
  signIn,
  signUp,
  webHeaders,
  type TestContext,
} from '../../test/helpers';

describe('registro, login y logout', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });
  afterAll(() => context.close());

  it('registrarse crea la sesion y el espacio personal (workspace + membership owner + settings)', async () => {
    const { response, cookie } = await signUp(context, ANA);
    expect(response.statusCode).toBe(200);

    const me = await get(context, '/api/v1/me', cookie);
    expect(me.statusCode).toBe(200);
    const body = meResponseSchema.parse(me.json());
    expect(body.user).toMatchObject({ name: ANA.name, email: ANA.email });
    expect(body.workspace).toMatchObject({ kind: 'personal', role: 'owner' });

    const { db } = context.database;
    const [created] = await db.select().from(user).where(eq(user.email, ANA.email));
    const rows = await db.select().from(membership).where(eq(membership.userId, created!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workspaceId: body.workspace.id, role: 'owner' });

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, created!.id));
    expect(settings).toMatchObject({ activeWorkspaceId: body.workspace.id, theme: 'system' });

    const [space] = await db.select().from(workspace).where(eq(workspace.id, body.workspace.id));
    expect(space).toMatchObject({ kind: 'personal', createdBy: created!.id });
  });

  it('la cookie de sesion es httpOnly y SameSite=Lax', async () => {
    const { response } = await signUp(context, BEA);
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toContain('session_token=');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it('guarda la contrasena con hash y nunca la devuelve', async () => {
    const { response } = await signUp(context, {
      name: 'Carla',
      email: 'carla@example.com',
      password: 'contrasena-de-carla',
    });
    expect(response.body).not.toContain('contrasena-de-carla');
    expect(response.body.toLowerCase()).not.toContain('password');

    const [created] = await context.database.db
      .select()
      .from(user)
      .where(eq(user.email, 'carla@example.com'));
    const [credential] = await context.database.db
      .select()
      .from(account)
      .where(eq(account.userId, created!.id));
    expect(credential!.password).toBeTruthy();
    expect(credential!.password).not.toContain('contrasena-de-carla');
    // scrypt de Better Auth: "<sal>:<hash>" en hexadecimal.
    expect(credential!.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('un email repetido se rechaza y no crea otro espacio', async () => {
    const before = await context.database.db.select().from(workspace);
    const { response } = await signUp(context, ANA);
    expect(response.statusCode).toBe(422);
    const after = await context.database.db.select().from(workspace);
    expect(after).toHaveLength(before.length);
  });

  it('el email no distingue mayusculas', async () => {
    const { response } = await signUp(context, { ...ANA, email: 'ANA@example.com' });
    expect(response.statusCode).toBe(422);
  });

  it('rechaza una contrasena demasiado corta', async () => {
    const { response } = await signUp(context, {
      name: 'Dani',
      email: 'dani@example.com',
      password: 'corta',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
  });

  it('permite entrar con las credenciales correctas', async () => {
    const { response, cookie } = await signIn(context, ANA);
    expect(response.statusCode).toBe(200);
    expect((await get(context, '/api/v1/me', cookie)).statusCode).toBe(200);
  });

  it('rechaza una contrasena incorrecta y un usuario inexistente con el mismo error', async () => {
    const wrongPassword = await signIn(context, { ...ANA, password: 'incorrecta-123' });
    const unknownUser = await signIn(context, { ...ANA, email: 'nadie@example.com' });
    expect(wrongPassword.response.statusCode).toBe(401);
    expect(unknownUser.response.statusCode).toBe(401);
    expect(wrongPassword.response.json()).toEqual(unknownUser.response.json());
    expect(wrongPassword.cookie).toBe('');
  });

  it('cerrar sesion invalida la cookie', async () => {
    const { cookie } = await signIn(context, ANA);
    const out = await context.app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-out',
      headers: webHeaders(context.env, cookie),
      payload: {},
    });
    expect(out.statusCode).toBe(200);
    expect((await get(context, '/api/v1/me', cookie)).statusCode).toBe(401);
  });

  it('sin sesion, /me responde 401', async () => {
    expect((await get(context, '/api/v1/me')).statusCode).toBe(401);
  });

  it('una cookie manipulada no da acceso', async () => {
    const { cookie } = await signIn(context, ANA);
    const tampered = cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    expect((await get(context, '/api/v1/me', tampered)).statusCode).toBe(401);
  });
});

describe('ALLOW_SIGNUP (D7)', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext({ ALLOW_SIGNUP: 'true' });
  });
  afterAll(() => context.close());

  it('con ALLOW_SIGNUP=false no se puede registrar nadie, pero los existentes siguen entrando', async () => {
    expect((await signUp(context, ANA)).response.statusCode).toBe(200);

    await context.rebuild({ ALLOW_SIGNUP: 'false' });

    const blocked = await signUp(context, BEA);
    expect(blocked.response.statusCode).toBeGreaterThanOrEqual(400);
    expect(blocked.cookie).toBe('');
    const users = await context.database.db.select().from(user);
    expect(users.map((u) => u.email)).toEqual([ANA.email]);

    const login = await signIn(context, ANA);
    expect(login.response.statusCode).toBe(200);
  });
});

describe('comprobacion de Origin', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });
  afterAll(() => context.close());

  const payload = { name: 'X', email: 'x@example.com', password: 'una-contrasena-larga' };

  it('rechaza un registro sin cookie que llega desde otro origen', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-up/email',
      headers: { ...webHeaders(context.env), origin: 'https://evil.example' },
      payload,
    });
    expect(response.statusCode).toBe(403);
    expect(await context.database.db.select().from(user)).toHaveLength(0);
  });

  it('rechaza cualquier metodo que cambie estado desde otro origen, tambien con cookie', async () => {
    const { cookie } = await signUp(context, ANA);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const response = await context.app.inject({
        method,
        url: '/api/v1/auth/sign-out',
        headers: { ...webHeaders(context.env, cookie), origin: 'https://evil.example' },
        payload: {},
      });
      expect(response.statusCode, method).toBe(403);
    }
    // La sesion sigue viva: el ataque no consiguio cerrarla.
    expect((await get(context, '/api/v1/me', cookie)).statusCode).toBe(200);
  });

  it('rechaza Origin: null', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { ...webHeaders(context.env), origin: 'null' },
      payload: { email: ANA.email, password: ANA.password },
    });
    expect(response.statusCode).toBe(403);
  });

  it('acepta el origen de la web y las lecturas desde cualquier origen', async () => {
    const same = await signIn(context, ANA);
    expect(same.response.statusCode).toBe(200);

    const read = await context.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(read.statusCode).toBe(200);
  });
});

describe('cookies en produccion', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext({
      NODE_ENV: 'production',
      APP_URL: 'https://organizador.example.com',
      BETTER_AUTH_SECRET: 'p'.repeat(48),
    });
  });
  afterAll(() => context.close());

  it('marca la cookie como Secure, HttpOnly y SameSite=Lax', async () => {
    const { response, cookie } = await signUp(context, ANA);
    expect(response.statusCode).toBe(200);
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/__Secure-better-auth\.session_token=/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect((await get(context, '/api/v1/me', cookie)).statusCode).toBe(200);
  });
});

describe('limite de intentos', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext(
      {},
      { authRateLimit: { write: { max: 3, timeWindow: '1 minute' } } },
    );
  });
  afterAll(() => context.close());

  it('responde 429 con Retry-After tras demasiados intentos de login desde la misma IP', async () => {
    const attempt = () => signIn(context, { ...ANA, password: 'incorrecta-123' });
    for (let i = 0; i < 3; i += 1) expect((await attempt()).response.statusCode).toBe(401);

    const limited = (await attempt()).response;
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.json().message).toMatch(/Demasiados intentos/);
  });

  it('no limita el resto de la API', async () => {
    expect((await get(context, '/api/v1/health')).statusCode).toBe(200);
  });
});
