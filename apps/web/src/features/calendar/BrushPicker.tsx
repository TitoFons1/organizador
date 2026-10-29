import { MARK_KINDS, type MarkKind } from '@organizador/shared';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { KIND_SYMBOL, kindStyle } from './kind-style';

interface BrushPickerProps {
  brush: MarkKind | null;
  onChange: (brush: MarkKind | null) => void;
}

const optionClasses =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:ring-2 peer-focus-visible:ring-primary';

/** La leyenda del calendario es tambien el selector de pincel (radios nativos: teclado gratis). */
export function BrushPicker({ brush, onChange }: BrushPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <legend className="px-1 text-sm font-semibold">{es.calendar.legend}</legend>
      <p className="text-sm text-fg-muted">{es.calendar.legendHint}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex">
          <input
            type="radio"
            name="brush"
            className="peer sr-only"
            checked={brush === null}
            onChange={() => onChange(null)}
          />
          <span className={cn(optionClasses, 'w-full bg-surface')}>{es.calendar.noBrush}</span>
        </label>
        {MARK_KINDS.map((kind) => {
          const style = kindStyle(kind);
          return (
            <label key={kind} className="flex">
              <input
                type="radio"
                name="brush"
                className="peer sr-only"
                checked={brush === kind}
                onChange={() => onChange(kind)}
              />
              <span className={cn(optionClasses, 'w-full', style.className)} style={style.style}>
                <span aria-hidden>{KIND_SYMBOL[kind]}</span>
                {es.calendar.kinds[kind]}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
