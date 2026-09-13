import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClinicalCard, Badge, Alert } from '@medical-os/design-system';
import { PatientRepository, DiagnosticReportRepository } from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';

export const dynamic = 'force-dynamic';

/**
 * Home / Command Center (§2.2): sólo lo accionable. La lista de pacientes ya
 * se lee de Neon (NIVEL 3). Pendientes y resultados llegan con sus tablas
 * (NIVEL 9 / NIVEL 3+); hoy placeholders honestos, no datos sintéticos.
 */
export default async function HomePage() {
  const ctx = await getRequestContext();

  // Sesión sin clínica (el middleware ya garantizó login): onboarding (§28 paso 1).
  if (!ctx) redirect('/onboarding');

  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Command Center</h1>
      <p className="mos-page__subtitle">
        Trabajo del día · {new Date().toLocaleDateString('es-MX')}
      </p>
      <HomeContent ctx={ctx} />
    </div>
  );
}

async function HomeContent({
  ctx,
}: {
  ctx: NonNullable<Awaited<ReturnType<typeof getRequestContext>>>;
}) {
  const db = getDb();
  const patients = await new PatientRepository(db, ctx).listRecent(8);
  const pendingResults = await new DiagnosticReportRepository(db, ctx).listPendingReview(20);

  // Escalamiento de anormales (§27): críticos primero, luego alto/bajo, luego normal.
  const rank = (f: string): number => (f === 'critical' ? 0 : f === 'high' || f === 'low' ? 1 : 2);
  const sortedResults = [...pendingResults].sort(
    (a, b) => rank(a.abnormalFlag) - rank(b.abnormalFlag),
  );
  const criticalCount = pendingResults.filter((r) => r.abnormalFlag === 'critical').length;
  const abnormalCount = pendingResults.filter((r) =>
    ['critical', 'high', 'low'].includes(r.abnormalFlag),
  ).length;

  return (
    <>
      {criticalCount > 0 ? (
        <Alert severity="critical" title={`${criticalCount} resultado(s) CRÍTICO(s) sin revisar`}>
          Requieren atención inmediata. Revísalos y cierra el circuito con el paciente.
          <div style={{ height: 'var(--space-2)' }} />
          {sortedResults
            .filter((r) => r.abnormalFlag === 'critical')
            .map((r) => (
              <div key={r.id}>
                <Link href={`/patients/${r.patientId}`}>
                  {r.code}: {r.value} →
                </Link>
              </div>
            ))}
        </Alert>
      ) : abnormalCount > 0 ? (
        <Alert severity="warning" title={`${abnormalCount} resultado(s) anormal(es) sin revisar`}>
          Hay resultados fuera de rango pendientes de revisión.
        </Alert>
      ) : null}

      {criticalCount > 0 || abnormalCount > 0 ? <div style={{ height: 'var(--space-4)' }} /> : null}

      <Alert severity="info" title="Medical OS · R0">
        La <Link href="/org">organización</Link> y los <Link href="/patients">pacientes</Link> ya se
        leen de Neon, tenant-scoped (NIVEL 2/3). El resto del expediente clínico llega en niveles
        posteriores.
      </Alert>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="mos-grid">
        <ClinicalCard
          title="Pacientes recientes"
          action={
            <Link className="mos-muted" href="/patients">
              Ver todos
            </Link>
          }
        >
          {patients.length === 0 ? (
            <p className="mos-muted">Aún no hay pacientes. Créalos en la sección Pacientes.</p>
          ) : (
            <ul className="mos-list">
              {patients.map((p) => (
                <li key={p.id}>
                  <Link className="mos-link-row" href={`/patients/${p.id}`}>
                    <span>
                      <strong>{fullPatientName(p)}</strong>
                      <br />
                      <span className="mos-muted">
                        {ageLabel(p.birthDate)} · {sexLabel(p.sex)} · MRN {p.mrn}
                      </span>
                    </span>
                    <Badge tone="neutral">Ver</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClinicalCard>

        <ClinicalCard title="Pendientes clínicos">
          <p className="mos-muted">Obligaciones y tareas adicionales llegan con la agenda (R3).</p>
        </ClinicalCard>

        <ClinicalCard title={`Resultados por revisar (${pendingResults.length})`}>
          {pendingResults.length === 0 ? (
            <p className="mos-muted">Sin resultados pendientes. Closed-loop al día.</p>
          ) : (
            <ul className="mos-list">
              {sortedResults.map((r) => (
                <li key={r.id} className="mos-list__item">
                  <Link className="mos-link-row" href={`/patients/${r.patientId}`}>
                    <span>
                      {r.code}: <strong>{r.value}</strong>
                    </span>
                  </Link>
                  <Badge
                    tone={
                      r.abnormalFlag === 'critical'
                        ? 'critical'
                        : r.abnormalFlag === 'normal'
                          ? 'success'
                          : 'warning'
                    }
                  >
                    {r.abnormalFlag}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </ClinicalCard>
      </div>
    </>
  );
}
