import Link from 'next/link';
import { ClinicalCard, Badge, Alert } from '@medical-os/design-system';
import { listMockPatients } from '@/lib/mock-data';

/**
 * Home / Command Center (§2.2): sólo lo accionable — agenda, resultados,
 * pendientes, riesgos. Prototipo navegable con datos sintéticos (gate NIVEL 1).
 */
export default function HomePage() {
  const patients = listMockPatients();

  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Command Center</h1>
      <p className="mos-page__subtitle">
        Trabajo del día · {new Date().toLocaleDateString('es-MX')}
      </p>

      <Alert severity="info" title="Prototipo R0 (NIVEL 1)">
        Pacientes con datos sintéticos (NIVEL 3 traerá la verdad clínica real). La{' '}
        <Link href="/org">organización y consultorios</Link> ya se leen desde Neon, tenant-scoped
        (NIVEL 2).
      </Alert>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="mos-grid">
        <ClinicalCard
          title="Pacientes de hoy"
          action={
            <Link className="mos-muted" href="/patients">
              Ver todos
            </Link>
          }
        >
          <ul className="mos-list">
            {patients.map((p) => (
              <li key={p.id}>
                <Link className="mos-link-row" href={`/patients/${p.id}`}>
                  <span>
                    <strong>{p.fullName}</strong>
                    <br />
                    <span className="mos-muted">
                      {p.ageLabel} · {p.sexLabel}
                    </span>
                  </span>
                  {p.allergies.length > 0 ? (
                    <Badge tone="critical">Alergia</Badge>
                  ) : (
                    <Badge tone="neutral">NKDA</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </ClinicalCard>

        <ClinicalCard title="Pendientes clínicos">
          <ul className="mos-list">
            {patients.flatMap((p) =>
              p.pending.map((task) => (
                <li key={`${p.id}-${task.label}`} className="mos-list__item">
                  <span>
                    {task.label}
                    <br />
                    <span className="mos-muted">
                      {p.fullName} · {task.owner}
                    </span>
                  </span>
                  <Badge
                    tone={
                      task.severity === 'critical'
                        ? 'critical'
                        : task.severity === 'warning'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {task.due}
                  </Badge>
                </li>
              )),
            )}
          </ul>
        </ClinicalCard>

        <ClinicalCard title="Resultados por revisar">
          <ul className="mos-list">
            {patients.flatMap((p) =>
              p.recentResults
                .filter((r) => r.flag !== 'normal')
                .map((r) => (
                  <li key={`${p.id}-${r.name}`} className="mos-list__item">
                    <span>
                      {r.name}: <strong>{r.value}</strong>
                      <br />
                      <span className="mos-muted">{p.fullName}</span>
                    </span>
                    <Badge tone={r.flag === 'critical' ? 'critical' : 'warning'}>
                      {r.flag === 'high' ? 'Alto' : r.flag === 'low' ? 'Bajo' : 'Crítico'}
                    </Badge>
                  </li>
                )),
            )}
          </ul>
        </ClinicalCard>
      </div>
    </div>
  );
}
