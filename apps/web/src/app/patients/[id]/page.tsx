import { notFound } from 'next/navigation';
import {
  PatientHeader,
  AllergyBanner,
  ClinicalCard,
  Badge,
  Button,
} from '@medical-os/design-system';
import { getMockPatient } from '@/lib/mock-data';

/**
 * Patient Workspace (§NIVEL 4) — shell de 3 columnas (§2.1):
 * timeline · workspace clínico · context rail.
 *
 * Puerta de salida NIVEL 4: desde la apertura del paciente el médico responde
 * en <30 s problemas activos, alergias, medicación, cambios y pendientes.
 */
export default async function PatientWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = getMockPatient(id);
  if (!patient) notFound();

  const criticalFlags = patient.allergies.length
    ? [{ label: `Alergia: ${patient.allergies[0]}`, tone: 'critical' as const }]
    : [];

  return (
    <div>
      <PatientHeader
        fullName={patient.fullName}
        ageLabel={patient.ageLabel}
        sexLabel={patient.sexLabel}
        mrn={patient.mrn}
        criticalFlags={criticalFlags}
        actions={<Button variant="primary">Iniciar consulta</Button>}
      />
      <AllergyBanner allergies={patient.allergies} notAssessed={!patient.allergiesAssessed} />

      <div className="mos-workspace">
        {/* Columna 1: Timeline / navegación */}
        <aside className="mos-workspace__col mos-workspace__timeline" aria-label="Línea de tiempo">
          <p className="mos-section-label">Timeline</p>
          {patient.timeline.map((e) => (
            <div key={`${e.date}-${e.kind}`} className="mos-timeline-entry">
              <div className="mos-timeline-entry__date">
                {e.date} · {e.kind}
              </div>
              <div className="mos-timeline-entry__summary">{e.summary}</div>
            </div>
          ))}
        </aside>

        {/* Columna 2: Workspace clínico */}
        <section className="mos-workspace__col mos-workspace__main" aria-label="Resumen clínico">
          <ClinicalCard title="Problemas activos">
            <ul className="mos-list">
              {patient.activeProblems.map((p) => (
                <li key={p.label} className="mos-list__item">
                  <span>{p.label}</span>
                  <span className="mos-muted">desde {p.since}</span>
                </li>
              ))}
            </ul>
          </ClinicalCard>

          <ClinicalCard title="Medicación actual">
            <ul className="mos-list">
              {patient.medications.map((m) => (
                <li key={m.name} className="mos-list__item">
                  <span>
                    <strong>{m.name}</strong> {m.dose}
                    <br />
                    <span className="mos-muted">{m.sig}</span>
                  </span>
                </li>
              ))}
            </ul>
          </ClinicalCard>

          <ClinicalCard title="Últimos resultados">
            <ul className="mos-list">
              {patient.recentResults.map((r) => (
                <li key={r.name} className="mos-list__item">
                  <span>
                    {r.name}: <strong>{r.value}</strong>{' '}
                    <span className="mos-muted">({r.date})</span>
                  </span>
                  {r.flag !== 'normal' ? (
                    <Badge tone={r.flag === 'critical' ? 'critical' : 'warning'}>
                      {r.flag === 'high' ? 'Alto' : r.flag === 'low' ? 'Bajo' : 'Crítico'}
                    </Badge>
                  ) : (
                    <Badge tone="success">Normal</Badge>
                  )}
                </li>
              ))}
            </ul>
          </ClinicalCard>
        </section>

        {/* Columna 3: Context Rail (copilot / pendientes) */}
        <aside
          className="mos-workspace__col mos-workspace__rail"
          aria-label="Pendientes y contexto"
        >
          <p className="mos-section-label">Pendientes</p>
          <ul className="mos-list">
            {patient.pending.map((task) => (
              <li key={task.label} className="mos-list__item">
                <span>{task.label}</span>
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
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
