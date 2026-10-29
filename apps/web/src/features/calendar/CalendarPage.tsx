import {
  calendarWarnings,
  DEFAULT_BLOCKS_CLASSES,
  MARK_MAX_DAYS,
  markLength,
  marksOn,
  todayCivil,
  type CivilDate,
  type Mark,
  type MarkKind,
} from '@organizador/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { formatLong } from '../../lib/dates';
import { CALENDAR_KEY, createMark, deleteMark, fetchCalendar, importSeed } from './api';
import { BrushPicker } from './BrushPicker';
import { courseMonths, warningText } from './calendar-view';
import { DayPanel } from './DayPanel';
import { MarkForm } from './MarkForm';
import { MonthGrid } from './MonthGrid';
import { TermsSection } from './TermsSection';

/** Marca abierta en el formulario: sin `mark` es una nueva que empieza en `date`. */
interface Editing {
  mark?: Mark;
  date: CivilDate;
}

/**
 * Calendario del curso (M3): los 12 meses con la leyenda del Excel. Con un pincel se pinta un
 * periodo tocando su primer y su ultimo dia; sin pincel, tocar un dia muestra y edita sus marcas.
 */
export function CalendarPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CALENDAR_KEY, queryFn: fetchCalendar });
  const [brush, setBrush] = useState<MarkKind | null>(null);
  const [anchor, setAnchor] = useState<CivilDate | null>(null);
  const [selectedDay, setSelectedDay] = useState<CivilDate | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const today = todayCivil();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });

  const importer = useMutation({
    mutationFn: importSeed,
    onSuccess: async (result) => {
      setNotice(es.calendar.imported(result.createdMarks, result.createdTerms));
      await invalidate();
    },
  });
  const paint = useMutation({
    mutationFn: createMark,
    onSuccess: async (mark) => {
      const kind = es.calendar.kinds[mark.kind];
      setNotice(es.calendar.painted(kind, formatLong(mark.startDate), formatLong(mark.endDate)));
      await invalidate();
    },
  });
  const removeMark = useMutation({
    mutationFn: (mark: Mark) => deleteMark(mark.id),
    onSuccess: invalidate,
  });

  // En movil el panel queda debajo de los meses: se trae a la vista al elegir un dia.
  useEffect(() => {
    if (selectedDay || editing) {
      panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDay, editing]);

  const chooseBrush = (next: MarkKind | null) => {
    setBrush(next);
    setAnchor(null);
    setNotice(null);
    setSelectedDay(null);
    setEditing(null);
  };

  const onDayClick = (date: CivilDate) => {
    if (brush === null) {
      setEditing(null);
      setSelectedDay(date === selectedDay ? null : date);
      return;
    }
    if (anchor === null) {
      setAnchor(date);
      setNotice(null);
      return;
    }
    // Se puede tocar primero el ultimo dia: el rango se ordena solo.
    const [startDate, endDate] = anchor <= date ? [anchor, date] : [date, anchor];
    setAnchor(null);
    if (markLength({ startDate, endDate }) > MARK_MAX_DAYS) {
      setNotice(es.calendar.markForm.tooLong);
      return;
    }
    paint.mutate({
      kind: brush,
      startDate,
      endDate,
      label: es.calendar.kinds[brush],
      blocksClasses: DEFAULT_BLOCKS_CLASSES[brush],
      groups: null,
    });
  };

  const header = <h1 className="text-2xl font-semibold">{es.calendar.title}</h1>;

  if (query.isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        {header}
        <p className="text-fg-muted">{es.common.loading}</p>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4">
        {header}
        <p role="alert">{es.calendar.loadError}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {es.common.retry}
        </Button>
      </div>
    );
  }

  const { marks, terms } = query.data;
  const isEmpty = marks.length === 0 && terms.length === 0;
  const warnings = isEmpty ? [] : calendarWarnings(terms, marks);
  const failed = importer.isError || paint.isError || removeMark.isError;
  const brushName = brush ? es.calendar.kinds[brush] : '';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {header}

      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {es.calendar.actionError}
        </p>
      ) : null}
      {notice && brush === null ? (
        <p role="status" className="text-sm font-medium">
          {notice}
        </p>
      ) : null}

      {isEmpty ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
          <h2 className="text-lg font-medium">{es.calendar.emptyTitle}</h2>
          <p className="text-fg-muted">{es.calendar.emptyText}</p>
          <Button onClick={() => importer.mutate()} disabled={importer.isPending}>
            <Download aria-hidden className="size-4" />
            {importer.isPending ? es.calendar.importing : es.calendar.importSeed}
          </Button>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">{es.calendar.warningsTitle}</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {warnings.map((warning) => (
              <li key={JSON.stringify(warning)}>{warningText(warning)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <BrushPicker brush={brush} onChange={chooseBrush} />

          {brush ? (
            // Pegada arriba: al bajar hasta mayo sigue viendose que pincel hay y que falta tocar.
            <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
              <p role="status" className="text-sm font-medium">
                {anchor
                  ? es.calendar.brushLast(brushName, formatLong(anchor))
                  : (notice ?? es.calendar.brushFirst(brushName))}
              </p>
              <div className="flex flex-wrap gap-2">
                {anchor ? (
                  <Button variant="secondary" onClick={() => setAnchor(null)}>
                    {es.calendar.cancelBrush}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => chooseBrush(null)}>
                  {es.calendar.noBrush}
                </Button>
              </div>
            </div>
          ) : null}

          <section
            aria-label={es.calendar.monthsTitle}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {courseMonths(marks, today).map((month) => (
              <MonthGrid
                key={month}
                month={month}
                marks={marks}
                today={today}
                selectedDay={brush ? null : selectedDay}
                anchor={anchor}
                onDayClick={onDayClick}
              />
            ))}
          </section>
        </div>

        <div
          ref={panelRef}
          className="flex scroll-mt-4 flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
        >
          {editing ? (
            <MarkForm
              {...(editing.mark ? { mark: editing.mark } : {})}
              date={editing.date}
              onDone={(saved) => {
                setEditing(null);
                setSelectedDay(saved.startDate);
              }}
              onCancel={() => setEditing(null)}
            />
          ) : selectedDay && brush === null ? (
            <DayPanel
              date={selectedDay}
              marks={marksOn(marks, selectedDay)}
              disabled={removeMark.isPending}
              onAdd={() => setEditing({ date: selectedDay })}
              onEdit={(mark) => setEditing({ mark, date: selectedDay })}
              onDelete={(mark) => removeMark.mutate(mark)}
              onClose={() => setSelectedDay(null)}
            />
          ) : null}

          <TermsSection terms={terms} />

          {isEmpty ? null : (
            <Button
              variant="secondary"
              onClick={() => importer.mutate()}
              disabled={importer.isPending}
              className="self-start"
            >
              <Download aria-hidden className="size-4" />
              {importer.isPending ? es.calendar.importing : es.calendar.importAgain}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
