import { SUBJECT_COLORS } from '@organizador/shared';
import type { ComponentPropsWithRef } from 'react';
import { es } from '../../i18n/es';
import { SUBJECT_PALETTE, subjectColorStyle } from '../../lib/subject-colors';

type RadioProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'value'>;

/**
 * 12 colores como radios nativos (teclado y lector de pantalla gratis). Se usa con
 * `{...form.register('color')}`. El color seleccionado se marca con un anillo, no solo con tono.
 */
export function ColorPicker(props: RadioProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{es.subjects.color}</legend>
      <div className="grid grid-cols-6 gap-2">
        {SUBJECT_COLORS.map((color) => (
          <label key={color} className="flex justify-center">
            <input type="radio" value={color} className="peer sr-only" {...props} />
            <span
              aria-hidden
              style={subjectColorStyle(color)}
              className="subject-dot size-10 cursor-pointer rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
            />
            <span className="sr-only">{SUBJECT_PALETTE[color].label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
