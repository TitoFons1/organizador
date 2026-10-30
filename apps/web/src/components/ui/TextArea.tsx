import { useId, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Como `Field`, pero para textos largos (descripciones, notas). */
export function TextArea({ label, error, className, id, ref, rows = 3, ...props }: TextAreaProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'rounded-lg border bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-muted',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
