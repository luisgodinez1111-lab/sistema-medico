import type { ReactNode } from 'react';

export interface ClinicalCardProps {
  title: string;
  /** Acción secundaria opcional (ej. "Ver todo"). La acción primaria vive fuera. */
  action?: ReactNode;
  children: ReactNode;
}

/** Tarjeta clínica base para paneles del Patient Workspace (§NIVEL 4). */
export function ClinicalCard({ title, action, children }: ClinicalCardProps) {
  return (
    <section className="mos-card">
      <header className="mos-card__header">
        <h2 className="mos-card__title">{title}</h2>
        {action}
      </header>
      <div className="mos-card__body">{children}</div>
    </section>
  );
}
