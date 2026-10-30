import { es } from '../../i18n/es';
import { WeekView } from '../schedule/WeekView';
import { TasksSection } from '../tasks/TasksSection';

/**
 * Panel principal (docs/01 7.2 y 7.3): la semana arriba y los pendientes abajo. En escritorio,
 * rejilla semanal y 4 columnas de pendientes, a la vista sin hacer scroll en 1280 px.
 */
export function PanelPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{es.nav.panel}</h1>
      <WeekView />
      <TasksSection />
    </div>
  );
}
