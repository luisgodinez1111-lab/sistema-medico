import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Icono/etiqueta textual: el riesgo nunca se expresa sólo con color (§2.3). */
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={`mos-badge mos-badge--${tone}`}>
      {icon}
      {children}
    </span>
  );
}
