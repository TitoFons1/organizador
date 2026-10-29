import type { Mark, Term } from '@organizador/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeBackend } from '../../test/fake-backend';
import { sentBodies } from '../../test/mock-api';
import { renderApp } from '../../test/render';

// Sin calendario cargado se pinta el curso de "hoy": se fija para que los tests no caduquen.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const day = (date: string) => {
  const button = document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  if (!button) throw new Error(`No se pinta el dia ${date}`);
  return button;
};

const pilar: Mark = {
  id: 'm-pilar',
  kind: 'festivo',
  startDate: '2026-10-12',
  endDate: '2026-10-12',
  label: 'Festivo (Pilar)',
  blocksClasses: true,
  groups: null,
};

describe('cargar el calendario del curso', () => {
  it('sin calendario ofrece cargar el 2026-27, que se ve pintado y sin avisos', async () => {
    createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/calendario');

    expect(await screen.findByText('Todavía no hay calendario')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cargar calendario 2026-27' }));

    expect(await screen.findByText('Añadidas 18 marcas y 2 cuatrimestres.')).toBeVisible();
    expect(day('2026-10-12')).toHaveAccessibleName(/Festivo \(Pilar\)/);
    expect(day('2026-12-24')).toHaveAccessibleName(/Vacaciones de Navidad/);
    expect(screen.getByText('1er cuatrimestre')).toBeVisible();
    expect(screen.queryByText('Datos por completar')).not.toBeInTheDocument();
    // Los 12 meses del curso, de septiembre a agosto.
    expect(screen.getByRole('region', { name: 'septiembre de 2026' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'agosto de 2027' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Volver a cargar el calendario 2026-27' }));
    expect(
      await screen.findByText('El calendario ya estaba completo: no había nada que añadir.'),
    ).toBeVisible();
  });

  it('avisa de los datos que faltan para calcular las clases', async () => {
    const start: Mark = { ...pilar, id: 'm-ini', kind: 'inicio_curso', label: 'Inicio' };
    const term: Term = {
      id: 't1',
      name: '1er cuatrimestre',
      startDate: '2026-10-01',
      endDate: null,
    };
    createFakeBackend({ marks: [start], terms: [term] }).install();
    renderApp('/calendario');

    expect(await screen.findByText('Datos por completar')).toBeVisible();
    expect(screen.getByText(/Falta la fecha de fin de curso/)).toBeVisible();
    expect(
      screen.getByText('El cuatrimestre «1er cuatrimestre» no tiene fecha de fin.'),
    ).toBeVisible();
  });
});

describe('pincel', () => {
  it('pinta un periodo tocando el primer y el ultimo dia, en cualquier orden', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/calendario');

    await user.click(await screen.findByRole('radio', { name: 'Vacaciones' }));
    expect(screen.getByRole('status')).toHaveTextContent('Vacaciones: toca el primer día.');

    await user.click(day('2026-12-24'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Vacaciones: desde el 24 de diciembre de 2026. Toca el último día',
    );
    await user.click(day('2026-12-22'));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Añadido: Vacaciones, del 22 de diciembre de 2026 al 24 de diciembre de 2026.',
    );
    expect(sentBodies(api, 'POST', '/api/v1/marks')).toEqual([
      {
        kind: 'vacaciones',
        startDate: '2026-12-22',
        endDate: '2026-12-24',
        label: 'Vacaciones',
        blocksClasses: true,
        groups: null,
      },
    ]);
    expect(day('2026-12-23')).toHaveAccessibleName(/Vacaciones/);
  });

  it('un solo dia es tocar dos veces el mismo, y se puede cancelar a medias', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/calendario');

    await user.click(await screen.findByRole('radio', { name: 'Defensa de proyectos' }));
    await user.click(day('2026-11-20'));
    await user.click(screen.getByRole('button', { name: 'Cancelar selección' }));
    expect(screen.getByRole('status')).toHaveTextContent('toca el primer día');

    await user.click(day('2026-11-20'));
    await user.click(day('2026-11-20'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Añadido: Defensa de proyectos, el 20 de noviembre de 2026.',
    );
    // Las defensas no anulan clases (decision del plan).
    expect(sentBodies(api, 'POST', '/api/v1/marks')[0]).toMatchObject({
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      blocksClasses: false,
    });
  });
});

describe('marcas de un dia', () => {
  it('sin pincel, tocar un dia muestra sus marcas y permite editarlas y borrarlas', async () => {
    const api = createFakeBackend({ marks: [pilar] }).install();
    const user = userEvent.setup();
    renderApp('/calendario');

    await screen.findByRole('radio', { name: 'Sin pincel' });
    await user.click(day('2026-10-12'));
    const panel = screen.getByRole('region', { name: 'Marcas del lunes, 12 de octubre de 2026' });
    expect(within(panel).getByText('Festivo (Pilar)')).toBeVisible();
    expect(within(panel).getByText(/Anula clases y tutorías/)).toBeVisible();

    await user.click(within(panel).getByRole('button', { name: 'Editar Festivo (Pilar)' }));
    const label = screen.getByLabelText('Descripción');
    await user.clear(label);
    await user.type(label, 'Pilar');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const updated = await screen.findByRole('region', { name: /Marcas del lunes, 12 de octubre/ });
    expect(within(updated).getByText('Pilar')).toBeVisible();
    expect(sentBodies(api, 'PATCH', '/api/v1/marks/m-pilar')[0]).toMatchObject({ label: 'Pilar' });

    await user.click(within(updated).getByRole('button', { name: 'Borrar Pilar' }));
    expect(await within(updated).findByText('Este día no tiene marcas.')).toBeVisible();
  });

  it('anade una marca a mano: propone tipo y bloqueo, y valida las fechas', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/calendario');

    await screen.findByRole('radio', { name: 'Sin pincel' });
    await user.click(day('2026-11-20'));
    await user.click(screen.getByRole('button', { name: 'Añadir marca a mano' }));

    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-20');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Defensa de proyectos');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Defensa de proyectos');
    expect(screen.getByLabelText('Anula clases y tutorías')).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-19' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La fecha final no puede ser anterior a la inicial.'),
    ).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/marks')).toEqual([]);

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-21' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('region', { name: /Marcas del viernes, 20 de noviembre/ });
    expect(sentBodies(api, 'POST', '/api/v1/marks')).toEqual([
      {
        kind: 'defensa_proyecto',
        label: 'Defensa de proyectos',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        blocksClasses: false,
        groups: null,
      },
    ]);
  });
});

describe('cuatrimestres', () => {
  it('se crean sin fecha de fin (con aviso), se completan y se borran', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/calendario');

    await user.click(await screen.findByRole('button', { name: 'Añadir cuatrimestre' }));
    await user.type(screen.getByLabelText('Nombre'), 'Primero');
    fireEvent.change(screen.getByLabelText('Empieza'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/sin fecha de fin/)).toBeVisible();
    expect(screen.getByText('El cuatrimestre «Primero» no tiene fecha de fin.')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/terms')).toEqual([
      { name: 'Primero', startDate: '2026-10-01', endDate: null },
    ]);

    await user.click(screen.getByRole('button', { name: 'Editar Primero' }));
    fireEvent.change(screen.getByLabelText('Termina (opcional)'), {
      target: { value: '2027-02-05' },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/5 de febrero de 2027/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Borrar Primero' }));
    expect(await screen.findByText('Aún no has definido los cuatrimestres.')).toBeVisible();
  });
});
