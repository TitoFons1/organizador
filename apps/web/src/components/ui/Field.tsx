import { useId, type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

/** Etiqueta + campo + pista + error, enlazados para lectores de pantalla. */
export function Field({ label, error, hint, className, id, ref, ...props }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'min-h-11 rounded-lg border bg-surface px-3 text-base text-fg placeholder:text-fg-muted',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
