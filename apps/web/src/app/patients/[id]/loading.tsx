/**
 * Estado de carga del Patient Workspace (DoD §31: loading explícito).
 * Reserva el layout de 3 columnas para evitar salto de contenido.
 */
export default function LoadingPatientWorkspace() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mos-patient-header">
        <div className="mos-patient-header__identity">
          <div className="mos-skeleton-line" style={{ width: '14rem', height: '1.4rem' }} />
          <div
            className="mos-skeleton-line"
            style={{ width: '10rem', marginTop: 'var(--space-2)' }}
          />
        </div>
      </div>
      <div className="mos-workspace">
        <aside className="mos-workspace__col mos-workspace__timeline" aria-hidden="true">
          <div className="mos-skeleton-line" style={{ width: '6rem' }} />
        </aside>
        <section className="mos-workspace__col mos-workspace__main" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mos-skeleton-card" />
          ))}
        </section>
        <aside className="mos-workspace__col mos-workspace__rail" aria-hidden="true">
          <div className="mos-skeleton-line" style={{ width: '6rem' }} />
        </aside>
      </div>
    </div>
  );
}
