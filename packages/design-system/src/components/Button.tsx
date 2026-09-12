import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/**
 * Botón base. Regla UX (§2.3): máximo 1 acción primaria por panel; el resto
 * usa `secondary`/`ghost`.
 */
export function Button({ variant = 'secondary', className, children, ...rest }: ButtonProps) {
  const classes = ['mos-btn', `mos-btn--${variant}`, className].filter(Boolean).join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
