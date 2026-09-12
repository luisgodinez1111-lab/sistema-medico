import type { ReactNode } from 'react';

export type AlertSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface AlertProps {
  severity?: AlertSeverity;
  title?: string;
  children?: ReactNode;
}

const ICON: Record<AlertSeverity, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  critical: '⛔',
};

/**
 * Alerta. Combina color + icono + texto (§2.3). En contexto clínico, la
 * severidad `critical` corresponde a alertas safety-critical del pathway engine
 * (§NIVEL 7), nunca a un simple aviso de UI.
 */
export function Alert({ severity = 'info', title, children }: AlertProps) {
  return (
    <div
      className={`mos-alert mos-alert--${severity}`}
      role={severity === 'critical' ? 'alert' : 'status'}
    >
      <span className="mos-alert__icon" aria-hidden="true">
        {ICON[severity]}
      </span>
      <div className="mos-alert__body">
        {title ? <p className="mos-alert__title">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
