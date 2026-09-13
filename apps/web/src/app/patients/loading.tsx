import { ClinicalCard } from '@medical-os/design-system';

/**
 * Estado de carga de la lista de pacientes (DoD §31: loading explícito).
 * Skeleton no bloqueante mientras el server component resuelve los datos.
 */
export default function LoadingPatients() {
  return (
    <div className="mos-page" aria-busy="true" aria-live="polite">
      <h1 className="mos-page__title">Pacientes</h1>
      <p className="mos-page__subtitle mos-muted">Cargando…</p>
      <div className="mos-grid">
        <ClinicalCard title="Pacientes">
          <ul className="mos-list">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="mos-skeleton-row" aria-hidden="true" />
            ))}
          </ul>
        </ClinicalCard>
      </div>
    </div>
  );
}
