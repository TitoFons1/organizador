import { meResponseSchema, workspaceResponseSchema } from '@organizador/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { membership, user, userSettings, workspace } from '../../db/schema';
import { ANA, BEA, createTestContext, get, signUp, type TestContext } from '../../test/helpers';
import { provisionPersonalWorkspace } from './provision';

describe('acceso cruzado entre dos usuarios (criterio de "hecho" de M1)', () => {
  let context: TestContext;
  let ana: { cookie: string; userId: string; workspaceId: string };
  let bea: { cookie: string; userId: string; workspaceId: string };

  async function register(credentials: typeof ANA) {
    const { cookie } = await signUp(context, credentials);
    const me = meResponseSchema.parse((await get(context, '/api/v1/me', cookie)).json());
    return { cookie, userId: me.user.id, workspaceId: me.workspace.id };
  }

  beforeAll(async () => {
    context = await createTestContext();
    // Rutas solo para los tests: ejercitan las dos formas del helper (espacio activo / explicito).
    const { app } = context;
    app.get('/test/workspaces/:id', async (request) =>
      app.requireWorkspaceAccess(request, {
        workspaceId: (request.params as { id: string }).id,
      }),
    );
    app.get('/test/workspaces/:id/admin', async (request) =>
      app.requireWorkspaceAccess(request, {
        workspaceId: (request.params as { id: string }).id,
        role: 'owner',
      }),
    );
    ana = await register(ANA);
    bea = await register(BEA);
  });
  afterAll(() => context.close());

  it('cada usuario tiene su propio espacio personal', () => {
    expect(ana.workspaceId).not.toBe(bea.workspaceId);
  });

  it('cada uno ve solo su espacio y a si mismo como unico miembro', async () => {
    for (const [self, other] of [
      [ana, bea],
      [bea, ana],
    ] as const) {
      const response = await get(context, '/api/v1/workspace', self.cookie);
      expect(response.statusCode).toBe(200);
      const body = workspaceResponseSchema.parse(response.json());
      expect(body.workspace.id).toBe(self.workspaceId);
      expect(body.role).toBe('owner');
      expect(body.members.map((m) => m.userId)).toEqual([self.userId]);
      expect(response.body).not.toContain(other.userId);
      expect(response.body).not.toContain(other.workspaceId);
    }
  });

  it('/me nunca mezcla datos de otro usuario', async () => {
    const body = (await get(context, '/api/v1/me', ana.cookie)).body;
    expect(body).toContain(ANA.email);
    expect(body).not.toContain(BEA.email);
  });

  it('pedir el espacio de otro usuario responde 404 (no revela que existe)', async () => {
    const foreign = await get(context, `/test/workspaces/${bea.workspaceId}`, ana.cookie);
    const missing = await get(context, '/test/workspaces/no-existe', ana.cookie);
    expect(foreign.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(foreign.json()).toEqual(missing.json());
  });

  it('el propio espacio si es accesible', async () => {
    const response = await get(context, `/test/workspaces/${ana.workspaceId}`, ana.cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ role: 'owner', workspace: { id: ana.workspaceId } });
  });

  it('sin sesion, ningun espacio es accesible (401)', async () => {
    expect((await get(context, `/test/workspaces/${ana.workspaceId}`)).statusCode).toBe(401);
    expect((await get(context, '/api/v1/workspace')).statusCode).toBe(401);
  });

  it('un miembro (no owner) accede al espacio pero no a lo reservado al owner (403)', async () => {
    await context.database.db
      .insert(membership)
      .values({ workspaceId: bea.workspaceId, userId: ana.userId, role: 'member' });

    const asMember = await get(context, `/test/workspaces/${bea.workspaceId}`, ana.cookie);
    expect(asMember.statusCode).toBe(200);
    expect(asMember.json()).toMatchObject({ role: 'member' });

    const admin = await get(context, `/test/workspaces/${bea.workspaceId}/admin`, ana.cookie);
    expect(admin.statusCode).toBe(403);

    const owner = await get(context, `/test/workspaces/${bea.workspaceId}/admin`, bea.cookie);
    expect(owner.statusCode).toBe(200);

    // Al quitarle la membresia pierde el acceso al instante.
    await context.database.db
      .delete(membership)
      .where(and(eq(membership.userId, ana.userId), eq(membership.workspaceId, bea.workspaceId)));
    expect((await get(context, `/test/workspaces/${bea.workspaceId}`, ana.cookie)).statusCode).toBe(
      404,
    );
  });
});

describe('aprovisionamiento del espacio personal', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });
  afterAll(() => context.close());

  async function userIdOf(email: string) {
    const [row] = await context.database.db.select().from(user).where(eq(user.email, email));
    return row!.id;
  }

  it('es idempotente: llamarlo dos veces no crea otro espacio', async () => {
    await signUp(context, ANA);
    const userId = await userIdOf(ANA.email);
    const first = await provisionPersonalWorkspace(context.database, userId);
    const second = await provisionPersonalWorkspace(context.database, userId);
    expect(second).toBe(first);

    const owned = await context.database.db
      .select()
      .from(workspace)
      .where(eq(workspace.createdBy, userId));
    expect(owned).toHaveLength(1);
  });

  it('dos reparaciones simultaneas dejan un unico espacio', async () => {
    await signUp(context, BEA);
    const userId = await userIdOf(BEA.email);
    await removeWorkspaceRows(userId);

    const ids = await Promise.all([
      provisionPersonalWorkspace(context.database, userId),
      provisionPersonalWorkspace(context.database, userId),
      provisionPersonalWorkspace(context.database, userId),
    ]);
    expect(new Set(ids).size).toBe(1);

    const owned = await context.database.db
      .select()
      .from(workspace)
      .where(eq(workspace.createdBy, userId));
    expect(owned).toHaveLength(1);
  });

  it('repara una cuenta que quedo sin espacio (registro interrumpido)', async () => {
    const { cookie } = await signUp(context, {
      name: 'Carla',
      email: 'carla@example.com',
      password: 'contrasena-de-carla',
    });
    const userId = await userIdOf('carla@example.com');
    await removeWorkspaceRows(userId);

    const response = await get(context, '/api/v1/me', cookie);
    expect(response.statusCode).toBe(200);
    const body = meResponseSchema.parse(response.json());
    expect(body.workspace).toMatchObject({ kind: 'personal', role: 'owner' });
  });

  async function removeWorkspaceRows(userId: string) {
    const { db } = context.database;
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    await db.delete(membership).where(eq(membership.userId, userId));
    await db.delete(workspace).where(eq(workspace.id, settings!.activeWorkspaceId));
  }
});
