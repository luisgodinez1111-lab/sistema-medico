import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';

export interface PatientHeaderProps {
  fullName: string;
  /** Edad ya formateada (ej. "34 a" o "6 m 12 d") — el cálculo vive en el dominio. */
  ageLabel: string;
  sexLabel?: string;
  mrn?: string;
  /** Banderas críticas persistentes (§27: identidad y riesgo siempre visibles). */
  criticalFlags?: ReadonlyArray<{ label: string; tone?: 'critical' | 'warning' | 'info' }>;
  actions?: ReactNode;
}

/**
 * Encabezado de paciente PERSISTENTE. Previene el error "paciente equivocado"
 * (§27) manteniendo identidad, edad, alergias/alertas y acciones siempre a la
 * vista, sin depender del scroll.
 */
export function PatientHeader({
  fullName,
  ageLabel,
  sexLabel,
  mrn,
  criticalFlags = [],
  actions,
}: PatientHeaderProps) {
  const meta = [ageLabel, sexLabel, mrn ? `MRN ${mrn}` : undefined].filter(Boolean).join(' · ');
  return (
    <header className="mos-patient-header">
      <div className="mos-patient-header__identity">
        <h1 className="mos-patient-header__name">{fullName}</h1>
        <span className="mos-patient-header__meta">{meta}</span>
      </div>
      <div className="mos-patient-header__flags">
        {criticalFlags.map((f) => (
          <Badge key={f.label} tone={f.tone ?? 'critical'}>
            {f.label}
          </Badge>
        ))}
        {actions}
      </div>
    </header>
  );
}
