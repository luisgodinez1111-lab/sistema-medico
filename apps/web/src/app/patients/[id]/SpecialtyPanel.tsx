import { ClinicalCard, Badge } from '@medical-os/design-system';
import type { SpecialtyPack } from '@medical-os/db';

/**
 * Panel de especialidad (R7). INFORMATIVO: muestra los quick-picks y order sets
 * del pack activo del tenant. No ejecuta nada — el clínico actúa por los flujos
 * permisados (problemas, órdenes). Contenido DEMO (no validado clínicamente).
 */
export function SpecialtyPanel({ pack }: { pack: SpecialtyPack }) {
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
          <ul className="mos-list">
            {pack.orderSets.map((o) => (
              <li key={o.code} className="mos-list__item">
                <span>{o.label}</span>
                <Badge tone="info">DEMO</Badge>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </ClinicalCard>
  );
}
