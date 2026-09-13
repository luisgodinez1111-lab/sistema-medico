import { notFound } from 'next/navigation';
import { PatientHeader, AllergyBanner, ClinicalCard, Button } from '@medical-os/design-system';
import {
  PatientRepository,
  AllergyRepository,
  ConditionRepository,
  ObservationRepository,
  RelatedPersonRepository,
  hasPermission,
} from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';
import { AllergyManager } from './AllergyManager';
import { ConditionManager } from './ConditionManager';
import { VitalsManager } from './VitalsManager';
import { ContactsManager } from './ContactsManager';
import { MergeManager } from './MergeManager';

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
  const reviewed = patient.allergiesReviewedAt !== null;
  const canWrite = hasPermission(ctx, 'patient.write');

  const allergyLabels = allergies.map((a) =>
    a.reaction ? `${a.substance} (${a.reaction})` : a.substance,
  );
  const criticalFlags = allergies
    .filter((a) => a.criticality === 'high')
    .map((a) => ({ label: `Alergia: ${a.substance}`, tone: 'critical' as const }));

  return (
    <div>
      <PatientHeader
        fullName={fullPatientName(patient)}
        ageLabel={ageLabel(patient.birthDate)}
        sexLabel={sexLabel(patient.sex)}
        mrn={patient.mrn}
        criticalFlags={criticalFlags}
        actions={<Button variant="primary">Iniciar consulta</Button>}
      />
      <AllergyBanner allergies={allergyLabels} notAssessed={allergies.length === 0 && !reviewed} />

      <div className="mos-workspace">
        <aside className="mos-workspace__col mos-workspace__timeline" aria-label="Línea de tiempo">
          <p className="mos-section-label">Timeline</p>
          <p className="mos-muted">Sin encuentros registrados (NIVEL 6).</p>
        </aside>

        <section className="mos-workspace__col mos-workspace__main" aria-label="Resumen clínico">
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

          <ClinicalCard title="Medicación actual">
            <p className="mos-muted">Disponible con prescripción estructurada (NIVEL 8).</p>
          </ClinicalCard>

          <MergeManager patientId={patient.id} canWrite={canWrite} />
        </section>

        <aside
          className="mos-workspace__col mos-workspace__rail"
          aria-label="Contactos, pendientes y contexto"
        >
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
          <p className="mos-section-label">Pendientes</p>
          <p className="mos-muted">Sin pendientes (NIVEL 9).</p>
        </aside>
      </div>
    </div>
  );
}
