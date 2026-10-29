import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeBackend, subjectFixture } from '../../test/fake-backend';
import { sentBodies } from '../../test/mock-api';
import { renderApp } from '../../test/render';

const programacion = subjectFixture({
  id: 's-pro',
  name: 'Programación',
  shortName: 'PRO',
  color: 'blue',
  teacher: 'Marta',
  position: 0,
  links: { classroom: 'https://aula.example.com/pro', notebooklm: null, repo: null },
});
const bases = subjectFixture({ id: 's-bbdd', name: 'Bases de Datos', color: 'green', position: 1 });

describe('lista de asignaturas', () => {
  it('muestra el estado vacio con una accion para crear la primera', async () => {
    createFakeBackend().install();
    renderApp('/asignaturas');

    expect(await screen.findByText('Aún no tienes asignaturas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Añadir la primera' })).toHaveAttribute(
      'href',
      '/asignaturas/nueva',
    );
  });

  it('muestra nombre, profesor y enlaces externos seguros', async () => {
    createFakeBackend({ subjects: [programacion] }).install();
    renderApp('/asignaturas');

    expect(await screen.findByRole('heading', { level: 2, name: 'Programación' })).toBeVisible();
    expect(screen.getByText('Profesor/a: Marta')).toBeVisible();
    const link = screen.getByRole('link', { name: 'Abrir Aula virtual de Programación' });
    expect(link).toHaveAttribute('href', 'https://aula.example.com/pro');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('mantiene el titulo de la pagina si el servidor falla', async () => {
    const backend = createFakeBackend();
    backend.handlers['GET /api/v1/subjects'] = { status: 500, body: { message: 'boom' } };
    backend.install();
    renderApp('/asignaturas');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se han podido cargar las asignaturas.',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Asignaturas' })).toBeVisible();
  });
});

describe('crear y editar', () => {
  it('crea una asignatura con color y enlaces y vuelve a la lista', async () => {
    const backend = createFakeBackend();
    const api = backend.install();
    const user = userEvent.setup();
    renderApp('/asignaturas');

    await user.click(await screen.findByRole('link', { name: 'Añadir la primera' }));
    await user.type(await screen.findByLabelText('Nombre'), 'Entornos de Desarrollo');
    await user.type(screen.getByLabelText('Abreviatura'), 'ENT');
    await user.type(screen.getByLabelText('Profesor/a (opcional)'), 'Luis');
    await user.click(screen.getByRole('radio', { name: 'Verde' }));
    await user.type(screen.getByLabelText('Aula virtual'), 'https://aula.example.com/ent');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Entornos de Desarrollo' }),
    ).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/subjects')).toEqual([
      {
        name: 'Entornos de Desarrollo',
        shortName: 'ENT',
        color: 'green',
        teacher: 'Luis',
        links: { classroom: 'https://aula.example.com/ent', notebooklm: null, repo: null },
      },
    ]);
  });

  it('los campos opcionales vacios se envian como null', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/asignaturas/nueva');

    await user.type(await screen.findByLabelText('Nombre'), 'FOL');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByRole('heading', { level: 2, name: 'FOL' });
    expect(sentBodies(api, 'POST', '/api/v1/subjects')[0]).toMatchObject({
      shortName: null,
      teacher: null,
      links: { classroom: null, notebooklm: null, repo: null },
    });
  });

  it('valida nombre y enlaces antes de enviar (no acepta javascript:)', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/asignaturas/nueva');

    await user.type(await screen.findByLabelText('Repositorio'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Este campo es obligatorio.')).toBeVisible();
    expect(screen.getByText('Escribe la dirección completa, empezando por https://')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/subjects')).toEqual([]);
  });

  it('edita una asignatura existente con los valores precargados', async () => {
    const api = createFakeBackend({ subjects: [programacion] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas');

    await user.click(await screen.findByRole('link', { name: 'Editar Programación' }));
    const name = await screen.findByLabelText('Nombre');
    expect(name).toHaveValue('Programación');
    expect(screen.getByLabelText('Profesor/a (opcional)')).toHaveValue('Marta');
    expect(screen.getByRole('radio', { name: 'Azul' })).toBeChecked();

    await user.clear(name);
    await user.type(name, 'Programación Java');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Programación Java' }),
    ).toBeVisible();
    expect(sentBodies(api, 'PATCH', '/api/v1/subjects/s-pro')[0]).toMatchObject({
      name: 'Programación Java',
      teacher: 'Marta',
      color: 'blue',
    });
  });

  it('avisa si la asignatura que se quiere editar no existe', async () => {
    createFakeBackend({ subjects: [programacion] }).install();
    renderApp('/asignaturas/otra/editar');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encuentra esta asignatura.');
  });
});

describe('ordenar y archivar', () => {
  it('reordena con los botones subir/bajar y el primero no puede subir', async () => {
    const api = createFakeBackend({ subjects: [programacion, bases] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas');

    await screen.findByRole('heading', { level: 2, name: 'Programación' });
    expect(screen.getByRole('button', { name: 'Subir Programación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Bases de Datos' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Bajar Programación' }));

    await screen.findByRole('button', { name: 'Subir Programación' }).then((button) => {
      expect(button).toBeEnabled();
    });
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names).toEqual(['Bases de Datos', 'Programación']);
    expect(sentBodies(api, 'PUT', '/api/v1/subjects/order')).toEqual([
      { ids: ['s-bbdd', 's-pro'] },
    ]);
  });

  it('archiva y recupera una asignatura', async () => {
    createFakeBackend({ subjects: [programacion, bases] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas');

    await user.click(await screen.findByRole('button', { name: 'Archivar Programación' }));

    const summary = await screen.findByText('Archivadas (1)');
    await user.click(summary);
    const archivedList = summary.closest('details')!;
    expect(within(archivedList).getByRole('heading', { name: 'Programación' })).toBeVisible();

    await user.click(
      within(archivedList).getByRole('button', { name: 'Recuperar Programación del archivo' }),
    );
    await screen.findByRole('button', { name: 'Archivar Programación' });
    expect(screen.queryByText(/Archivadas/)).not.toBeInTheDocument();
  });
});

describe('eliminar con doble confirmacion y papelera', () => {
  it('pide revisar el impacto, luego escribir el nombre, y envia la asignatura a la papelera', async () => {
    const api = createFakeBackend({ subjects: [programacion, bases] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas');

    await user.click(await screen.findByRole('link', { name: 'Eliminar Bases de Datos' }));
    expect(await screen.findByText('Vas a eliminar «Bases de Datos».')).toBeVisible();
    expect(screen.getByText(/Todavía no tiene tareas, notas ni franjas/)).toBeVisible();
    // Paso 1: todavia no se puede borrar.
    expect(screen.queryByRole('button', { name: 'Enviar a la papelera' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const confirm = screen.getByRole('button', { name: 'Enviar a la papelera' });
    expect(confirm).toBeDisabled();
    const input = screen.getByLabelText('Para confirmar, escribe «Bases de Datos»');
    await user.type(input, 'bases de');
    expect(confirm).toBeDisabled();
    await user.type(input, ' datos');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByRole('heading', { level: 2, name: 'Programación' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Bases de Datos' })).not.toBeInTheDocument();
    expect(sentBodies(api, 'DELETE', '/api/v1/subjects/s-bbdd')).toEqual([
      { confirmName: 'bases de datos' },
    ]);
  });

  it('muestra el error si el servidor rechaza el nombre', async () => {
    const backend = createFakeBackend({ subjects: [bases] });
    backend.handlers['DELETE /api/v1/subjects/:id'] = {
      status: 400,
      body: { message: 'No coincide', code: 'CONFIRM_NAME_MISMATCH' },
    };
    backend.install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-bbdd/eliminar');

    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'Bases de Datos');
    await user.click(screen.getByRole('button', { name: 'Enviar a la papelera' }));

    expect(await screen.findByText('El nombre no coincide.')).toBeVisible();
  });

  it('lo borrado aparece en la papelera y se puede restaurar', async () => {
    createFakeBackend({ subjects: [bases] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-bbdd/eliminar');

    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    await user.type(screen.getByLabelText(/Para confirmar/), 'Bases de Datos');
    await user.click(screen.getByRole('button', { name: 'Enviar a la papelera' }));
    await screen.findByText('Aún no tienes asignaturas');

    // Papelera: desde "Más".
    await user.click(screen.getAllByRole('link', { name: 'Más' })[0]!);
    await user.click(await screen.findByRole('link', { name: 'Papelera' }));
    expect(await screen.findByText('Bases de Datos')).toBeVisible();
    expect(screen.getByText(/Se borrará definitivamente el 7 de noviembre de 2026/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Restaurar Bases de Datos' }));
    expect(await screen.findByText('La papelera está vacía.')).toBeVisible();

    await user.click(screen.getAllByRole('link', { name: 'Asignaturas' })[0]!);
    expect(await screen.findByRole('heading', { level: 2, name: 'Bases de Datos' })).toBeVisible();
  });
});
