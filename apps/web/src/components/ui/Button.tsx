import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-contrast hover:opacity-90',
  secondary: 'border border-border bg-surface text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
};

/** Clases de boton, reutilizables en enlaces (`<Link className={buttonClasses()}>`). */
export function buttonClasses(variant: Variant = 'primary', className?: string) {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Objetivo tactil minimo de 44 px de alto (accesibilidad movil). */
export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}

/** Boton cuadrado de 44 px solo con icono: `label` es obligatorio (lo leen los lectores de pantalla). */
export function IconButton({
  label,
  className,
  children,
  variant = 'ghost',
  type = 'button',
  ...props
}: ButtonProps & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={buttonClasses(variant, cn('size-11 px-0', className))}
      {...props}
    >
      {children}
    </button>
  );
}
