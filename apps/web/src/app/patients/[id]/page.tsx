import { notFound } from 'next/navigation';
import { PatientHeader, AllergyBanner, ClinicalCard, Button } from '@medical-os/design-system';
import { PatientRepository } from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';

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

  const patient = await new PatientRepository(getDb(), ctx).findById(id as PatientId);
  if (!patient) notFound();

  // Las alergias aún no se capturan (llegan en NIVEL 3: Allergy). "No evaluadas".
  const allergiesAssessed = false;

  return (
    <div>
      <PatientHeader
        fullName={fullPatientName(patient)}
        ageLabel={ageLabel(patient.birthDate)}
        sexLabel={sexLabel(patient.sex)}
        mrn={patient.mrn}
        criticalFlags={[]}
        actions={<Button variant="primary">Iniciar consulta</Button>}
      />
      <AllergyBanner allergies={[]} notAssessed={!allergiesAssessed} />

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

          <ClinicalCard title="Problemas activos">
            <p className="mos-muted">Se capturan en el encuentro clínico (NIVEL 6).</p>
          </ClinicalCard>

          <ClinicalCard title="Medicación actual">
            <p className="mos-muted">Disponible con prescripción estructurada (NIVEL 8).</p>
          </ClinicalCard>
        </section>

        <aside
          className="mos-workspace__col mos-workspace__rail"
          aria-label="Pendientes y contexto"
        >
          <p className="mos-section-label">Pendientes</p>
          <p className="mos-muted">Sin pendientes (NIVEL 9).</p>
        </aside>
      </div>
    </div>
  );
}
