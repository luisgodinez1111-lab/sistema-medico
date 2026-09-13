import { notFound } from 'next/navigation';
import { PatientHeader, AllergyBanner, ClinicalCard, Badge } from '@medical-os/design-system';
import {
  PatientRepository,
  AllergyRepository,
  ConditionRepository,
  ObservationRepository,
  RelatedPersonRepository,
  HistoryRepository,
  EncounterRepository,
  MedicationRepository,
  ServiceRequestRepository,
  DiagnosticReportRepository,
  applicableHistorySections,
  HISTORY_SCHEMA_VERSION,
  computeCompleteness,
  applicablePathways,
  PATHWAYS_SOURCE,
  hasPermission,
} from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, ageYears, sexLabel } from '@/lib/patient-format';
import { AllergyManager } from './AllergyManager';
import { ConditionManager } from './ConditionManager';
import { VitalsManager } from './VitalsManager';
import { ContactsManager } from './ContactsManager';
import { HistoryManager } from './HistoryManager';
import { MergeManager } from './MergeManager';
import { EncounterStartButton } from './EncounterStartButton';
import { MedicationManager } from './MedicationManager';
import { OrdersManager } from './OrdersManager';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Patient Workspace (§NIVEL 4) — shell de 3 columnas (§2.1).
 * Datos demográficos reales desde Neon (NIVEL 3). Las secciones clínicas
 * (problemas, medicación, resultados, timeline) se poblarán cuando existan sus
 * tablas (Condition/Observation/MedicationRequest, §NIVEL 3+); hoy son honestos
 * placeholders, no datos sintéticos.
 */
export default async function PatientWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) notFound();

  const db = getDb();
  const patient = await new PatientRepository(db, ctx).findById(id as PatientId);
  if (!patient) notFound();

  const allergies = await new AllergyRepository(db, ctx).listForPatient(patient.id);
  const conditions = await new ConditionRepository(db, ctx).listActive(patient.id);
  const vitals = await new ObservationRepository(db, ctx).listForPatient(patient.id, 'vital-signs');
  const contacts = await new RelatedPersonRepository(db, ctx).listForPatient(patient.id);
  const encounters = await new EncounterRepository(db, ctx).listForPatient(patient.id);
  const medications = await new MedicationRepository(db, ctx).listActiveForPatient(patient.id);
  const orders = await new ServiceRequestRepository(db, ctx).listForPatient(patient.id);
  const reports = await new DiagnosticReportRepository(db, ctx).listForPatient(patient.id);

  // Historia clínica adaptativa: secciones por edad/sexo + valores ya capturados.
  const historySections = applicableHistorySections({
    ageYears: ageYears(patient.birthDate),
    sex: patient.sex,
  });
  const historyRows = await new HistoryRepository(db, ctx).listForPatient(patient.id);
  const historyValues: Record<string, string> = {};
  for (const row of historyRows) historyValues[`${row.section}:${row.code}`] = row.value;

  const reviewed = patient.allergiesReviewedAt !== null;
  const canWrite = hasPermission(ctx, 'patient.write');

  // Completitud del expediente (R4): calculada de los datos ya cargados.
  const completeness = computeCompleteness({
    allergiesAssessed: reviewed || allergies.length > 0,
    historyCaptured: historyRows.length > 0,
    hasVitals: vitals.length > 0,
    hasContact: contacts.length > 0,
    hasEncounter: encounters.length > 0,
  });

  // Guías de manejo (R4, DEMO) según los problemas activos.
  const pathways = applicablePathways(conditions.map((c) => ({ code: c.code })));

  const allergyLabels = allergies.map((a) =>
    a.reaction ? `${a.substance} (${a.reaction})` : a.substance,
  );
  const criticalFlags = allergies
    .filter((a) => a.criticality === 'high')
    .map((a) => ({ label: `Alergia: ${a.substance}`, tone: 'critical' as const }));

  // "Cambios desde la última visita" (§NIVEL 4): compara contra la fecha de la
  // última nota FIRMADA; cuenta lo registrado después en cada dominio clínico.
  const signedEncounters = encounters.filter((e) => e.status === 'signed' && e.signedAt);
  const lastVisitAt = signedEncounters.length
    ? signedEncounters.reduce(
        (max, e) => (e.signedAt! > max ? e.signedAt! : max),
        signedEncounters[0]!.signedAt!,
      )
    : null;
  const after = (d: Date | null | undefined): boolean => !!(lastVisitAt && d && d > lastVisitAt);
  const changeLines: string[] = lastVisitAt
    ? [
        [allergies.filter((a) => after(a.recordedAt)).length, 'alergia(s)'] as const,
        [conditions.filter((c) => after(c.recordedAt)).length, 'problema(s)'] as const,
        [vitals.filter((v) => after(v.effectiveAt)).length, 'signo(s) vital(es)'] as const,
        [medications.filter((m) => after(m.prescribedAt)).length, 'medicamento(s)'] as const,
        [reports.filter((r) => after(r.resultedAt)).length, 'resultado(s)'] as const,
      ]
        .filter(([n]) => n > 0)
        .map(([n, label]) => `${n} ${label}`)
    : [];

  return (
    <div>
      <PatientHeader
        fullName={fullPatientName(patient)}
        ageLabel={ageLabel(patient.birthDate)}
        sexLabel={sexLabel(patient.sex)}
        mrn={patient.mrn}
        criticalFlags={criticalFlags}
        actions={canWrite ? <EncounterStartButton patientId={patient.id} /> : null}
      />
      <AllergyBanner allergies={allergyLabels} notAssessed={allergies.length === 0 && !reviewed} />

      <div className="mos-workspace">
        <aside className="mos-workspace__col mos-workspace__timeline" aria-label="Línea de tiempo">
          <p className="mos-section-label">Timeline</p>
          {encounters.length === 0 ? (
            <p className="mos-muted">Sin encuentros registrados.</p>
          ) : (
            encounters.map((e) => (
              <Link
                key={e.id}
                href={`/patients/${patient.id}/encounters/${e.id}`}
                className="mos-timeline-entry"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div className="mos-timeline-entry__date">
                  {(e.signedAt ?? e.startedAt).toISOString().slice(0, 10)} ·{' '}
                  {e.status === 'signed' ? 'Firmado' : 'Borrador'}
                </div>
                <div className="mos-timeline-entry__summary">
                  {e.reason ?? 'Consulta'}
                  {e.assessment ? ` — ${e.assessment}` : ''}
                </div>
              </Link>
            ))
          )}
        </aside>

        <section className="mos-workspace__col mos-workspace__main" aria-label="Resumen clínico">
          <ClinicalCard title="Cambios desde la última visita">
            {!lastVisitAt ? (
              <p className="mos-muted">Sin visitas firmadas previas (primera consulta).</p>
            ) : changeLines.length === 0 ? (
              <p className="mos-muted">
                Sin cambios desde la última visita ({lastVisitAt.toISOString().slice(0, 10)}).
              </p>
            ) : (
              <>
                <p className="mos-muted">Desde {lastVisitAt.toISOString().slice(0, 10)}:</p>
                <ul className="mos-list">
                  {changeLines.map((line) => (
                    <li key={line} className="mos-list__item">
                      <span>{line}</span>
                      <Badge tone="info">nuevo</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ClinicalCard>

          <ClinicalCard title="Datos del paciente">
            <ul className="mos-list">
              <li className="mos-list__item">
                <span>Nombre</span>
                <strong>{fullPatientName(patient)}</strong>
              </li>
              <li className="mos-list__item">
                <span>Fecha de nacimiento</span>
                <span>
                  {patient.birthDate} ({ageLabel(patient.birthDate)})
                </span>
              </li>
              <li className="mos-list__item">
                <span>Sexo</span>
                <span>{sexLabel(patient.sex)}</span>
              </li>
              <li className="mos-list__item">
                <span>MRN</span>
                <span>{patient.mrn}</span>
              </li>
              {patient.curp ? (
                <li className="mos-list__item">
                  <span>CURP</span>
                  <span>{patient.curp}</span>
                </li>
              ) : null}
            </ul>
          </ClinicalCard>

          <AllergyManager
            patientId={patient.id}
            allergies={allergies.map((a) => ({
              id: a.id,
              substance: a.substance,
              category: a.category,
              criticality: a.criticality,
              reaction: a.reaction,
            }))}
            reviewed={reviewed}
            canWrite={canWrite}
          />

          <ConditionManager
            patientId={patient.id}
            conditions={conditions.map((c) => ({
              id: c.id,
              code: c.code,
              onsetDate: c.onsetDate,
            }))}
            canWrite={canWrite}
          />

          {pathways.length > 0 ? (
            <ClinicalCard title="Guías de manejo (DEMO)">
              <p className="mos-muted">{PATHWAYS_SOURCE} · según problemas activos</p>
              {pathways.map((pw) => (
                <div key={pw.match} style={{ marginTop: 'var(--space-3)' }}>
                  <p className="mos-section-label">{pw.title}</p>
                  <ul className="mos-list">
                    {pw.items.map((it) => (
                      <li key={it.label} className="mos-list__item">
                        <span>{it.label}</span>
                        <span className="mos-muted">{it.cadence}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </ClinicalCard>
          ) : null}

          <VitalsManager
            patientId={patient.id}
            vitals={vitals.map((v) => ({
              id: v.id,
              code: v.code,
              valueText: v.valueText,
              unit: v.unit,
              effectiveAt:
                v.effectiveAt instanceof Date ? v.effectiveAt.toISOString() : String(v.effectiveAt),
            }))}
            canWrite={canWrite}
          />

          <MedicationManager
            patientId={patient.id}
            medications={medications.map((m) => ({
              id: m.id,
              drug: m.drug,
              dose: m.dose,
              route: m.route,
              frequency: m.frequency,
            }))}
            canWrite={canWrite}
          />

          <OrdersManager
            patientId={patient.id}
            orders={orders.map((o) => ({
              id: o.id,
              code: o.code,
              category: o.category,
              priority: o.priority,
              status: o.status,
            }))}
            reports={reports.map((r) => ({
              id: r.id,
              code: r.code,
              value: r.value,
              abnormalFlag: r.abnormalFlag,
              reviewStatus: r.reviewStatus,
            }))}
            canWrite={canWrite}
          />

          <HistoryManager
            patientId={patient.id}
            sections={historySections}
            values={historyValues}
            schemaVersion={HISTORY_SCHEMA_VERSION}
            canWrite={canWrite}
          />

          <MergeManager patientId={patient.id} canWrite={canWrite} />
        </section>

        <aside
          className="mos-workspace__col mos-workspace__rail"
          aria-label="Contactos, pendientes y contexto"
        >
          <p className="mos-section-label">Completitud del expediente</p>
          <div className="mos-completeness">
            <div
              className="mos-completeness__bar"
              role="meter"
              aria-valuenow={completeness.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Completitud del expediente"
            >
              <span style={{ width: `${completeness.score}%` }} />
            </div>
            <strong>{completeness.score}%</strong>
          </div>
          <ul className="mos-list" style={{ marginTop: 'var(--space-2)' }}>
            {completeness.items.map((it) => (
              <li key={it.key} className="mos-list__item">
                <span className={it.done ? '' : 'mos-muted'}>
                  {it.done ? '✓' : '○'} {it.label}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ height: 'var(--space-5)' }} />

          <ContactsManager
            patientId={patient.id}
            contacts={contacts.map((c) => ({
              id: c.id,
              name: c.name,
              relationship: c.relationship,
              phone: c.phone,
              isEmergencyContact: c.isEmergencyContact,
            }))}
            canWrite={canWrite}
          />
          <div style={{ height: 'var(--space-5)' }} />
          <p className="mos-section-label">Gobernanza</p>
          <Link className="mos-muted" href={`/patients/${patient.id}/audit`}>
            Ver historial de auditoría →
          </Link>
          <br />
          <Link className="mos-muted" href={`/patients/${patient.id}/billing`}>
            Ver facturación →
          </Link>
          <br />
          <Link className="mos-muted" href={`/patients/${patient.id}/documents`}>
            Ver documentos →
          </Link>
          <br />
          <a
            className="mos-muted"
            href={`/api/patients/${patient.id}/fhir`}
            target="_blank"
            rel="noreferrer"
          >
            Exportar FHIR (R4) →
          </a>
        </aside>
      </div>
    </div>
  );
}
