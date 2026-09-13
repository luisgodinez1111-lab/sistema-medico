import { notFound } from 'next/navigation';
import {
  PatientRepository,
  MedicationRepository,
  PractitionerRepository,
  OrganizationRepository,
  FacilityRepository,
} from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

const ROUTE_LABEL: Record<string, string> = {
  oral: 'VO',
  iv: 'IV',
  im: 'IM',
  sc: 'SC',
  topical: 'tópica',
  inhaled: 'inhalada',
  other: 'otra',
};

/**
 * Receta imprimible (§28 paso 8). RENDERIZA datos estructurados ya existentes
 * (MedicationRequest activos); no genera ni almacena bytes (ADR-0003 §10). El
 * clínico imprime a PDF con el navegador. Tenant-scoped; 404 cross-tenant.
 */
export default async function PrescriptionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) notFound();

  const db = getDb();
  const patient = await new PatientRepository(db, ctx).findById(id as PatientId);
  if (!patient) notFound();

  const [medications, prescriber, orgs] = await Promise.all([
    new MedicationRepository(db, ctx).listActiveForPatient(patient.id),
    new PractitionerRepository(db, ctx).getCurrent(),
    new OrganizationRepository(db, ctx).list(),
  ]);
  const org = orgs[0];
  const facilities = org ? await new FacilityRepository(db, ctx).listByOrganization(org.id) : [];
  const facility = facilities[0];

  const today = new Date();
  const folio = `${today.toISOString().slice(0, 10).replace(/-/g, '')}-${patient.mrn}`;

  return (
    <div className="mos-print">
      <div className="mos-print__toolbar">
        <PrintButton />
      </div>

      <article className="mos-rx" aria-label="Receta médica">
        <header className="mos-rx__head">
          <div>
            <h1 className="mos-rx__clinic">{org?.name ?? 'Clínica'}</h1>
            {facility ? <p className="mos-rx__facility">{facility.name}</p> : null}
          </div>
          <div className="mos-rx__meta">
            <p>Folio: {folio}</p>
            <p>Fecha: {today.toLocaleDateString('es-MX')}</p>
          </div>
        </header>

        <section className="mos-rx__patient">
          <strong>{fullPatientName(patient)}</strong>
          <span>
            {ageLabel(patient.birthDate)} · {sexLabel(patient.sex)} · MRN {patient.mrn}
          </span>
        </section>

        <h2 className="mos-rx__title">Rp.</h2>
        {medications.length === 0 ? (
          <p>Sin medicamentos activos.</p>
        ) : (
          <ol className="mos-rx__list">
            {medications.map((m) => (
              <li key={m.id} className="mos-rx__item">
                <p className="mos-rx__drug">
                  {m.drug}
                  {m.dose ? ` — ${m.dose}` : ''}
                </p>
                <p className="mos-rx__sig">
                  {[
                    ROUTE_LABEL[m.route] ?? m.route,
                    m.frequency ?? '',
                    m.durationDays ? `por ${m.durationDays} días` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {m.instructions ? ` — ${m.instructions}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}

        <footer className="mos-rx__foot">
          <div className="mos-rx__sign">
            <span className="mos-rx__sign-line" />
            <p>{prescriber?.displayName ?? '—'}</p>
            <p className="mos-rx__sign-meta">
              {prescriber?.specialty ?? ''}
              {prescriber?.licenseNumber ? ` · Cédula ${prescriber.licenseNumber}` : ''}
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
