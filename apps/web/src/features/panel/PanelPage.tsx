import { es } from '../../i18n/es';
import { ServerStatus } from '../health/ServerStatus';
import { WeekView } from '../schedule/WeekView';
import { TasksSection } from '../tasks/TasksSection';

/** Panel principal: la semana arriba y los pendientes abajo (M6 lo redisena para movil). */
export function PanelPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{es.nav.panel}</h1>
      <WeekView />
      <TasksSection />
      <ServerStatus />
    </div>
  );
}
