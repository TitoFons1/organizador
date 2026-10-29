import { es } from '../../i18n/es';
import { ServerStatus } from '../health/ServerStatus';
import { WeekView } from '../schedule/WeekView';

/** Panel principal. En M4 es la semana con las clases reales; M6 le anade agenda y pendientes. */
export function PanelPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{es.nav.panel}</h1>
      <WeekView />
      <ServerStatus />
    </div>
  );
}
