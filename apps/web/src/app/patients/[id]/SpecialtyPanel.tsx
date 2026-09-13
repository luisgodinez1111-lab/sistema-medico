import { ClinicalCard, Badge } from '@medical-os/design-system';
import type { SpecialtyPack } from '@medical-os/db';
import { OrderSetActions } from './OrderSetActions';

/**
 * Panel de especialidad (R7). Muestra los quick-picks del pack activo (informativo)
 * y los order sets, que con permiso `patient.write` se solicitan en UN CLIC (el
 * clínico decide; cada clic crea una ServiceRequest auditada). Contenido DEMO.
 */
export function SpecialtyPanel({
  pack,
  patientId,
  canWrite,
}: {
  pack: SpecialtyPack;
  patientId: string;
  canWrite: boolean;
}) {
  const hasContent = pack.quickProblems.length > 0 || pack.orderSets.length > 0;
  if (!hasContent) return null;

  return (
    <ClinicalCard title={`Especialidad: ${pack.name}`}>
      <p className="mos-muted">
        Sugerencias de la especialidad. <strong>DEMO (no validado clínicamente)</strong>.
      </p>

      {pack.quickProblems.length > 0 ? (
        <>
          <p className="mos-section-label" style={{ marginTop: 'var(--space-3)' }}>
            Problemas frecuentes
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {pack.quickProblems.map((q) => (
              <Badge key={q.code} tone="neutral">
                {q.label}
              </Badge>
            ))}
          </div>
        </>
      ) : null}

      {pack.orderSets.length > 0 ? (
        <>
          <p className="mos-section-label" style={{ marginTop: 'var(--space-3)' }}>
            Order sets
          </p>
          {canWrite ? (
            <OrderSetActions patientId={patientId} items={pack.orderSets} />
          ) : (
            <ul className="mos-list">
              {pack.orderSets.map((o) => (
                <li key={o.code} className="mos-list__item">
                  <span>{o.label}</span>
                  <Badge tone="info">DEMO</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </ClinicalCard>
  );
}
