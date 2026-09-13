import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientHeader, ClinicalCard, Badge, Button } from '@medical-os/design-system';
import { PatientRepository, AuditRepository } from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  create: 'Creación',
  read: 'Lectura',
  update: 'Actualización',
  delete: 'Baja',
  sign: 'Firma',
  access_denied: 'Acceso denegado',
  cross_tenant_denied: 'Bloqueo cross-tenant',
};

/**
 * Audit trail del paciente (§NIVEL 2 gate, §19, §28 paso 15). Rastro append-only
 * de operaciones sensibles: quién, qué, cuándo, resultado y la decisión de
 * autorización correlacionada. Sin PHI en el detalle (§17).
 */
export default async function PatientAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) notFound();

  const db = getDb();
  const patient = await new PatientRepository(db, ctx).findById(id as PatientId);
  if (!patient) notFound();

  const events = await new AuditRepository(db, ctx).listForPatient(patient.id);

  return (
    <div>
      <PatientHeader
        fullName={fullPatientName(patient)}
        ageLabel={ageLabel(patient.birthDate)}
        sexLabel={sexLabel(patient.sex)}
        mrn={patient.mrn}
        criticalFlags={[]}
        actions={
          <Link href={`/patients/${patient.id}`}>
            <Button variant="secondary">Volver al expediente</Button>
          </Link>
        }
      />
      <div className="mos-page">
        <h1 className="mos-page__title">Historial de auditoría</h1>
        <p className="mos-page__subtitle">
          Rastro append-only de operaciones sensibles · {events.length} evento(s)
        </p>

        <ClinicalCard title="Eventos">
          {events.length === 0 ? (
            <p className="mos-muted">
              Sin eventos de auditoría todavía. Las operaciones sensibles (prescribir, firmar,
              solicitar/revisar estudios) quedan registradas aquí.
            </p>
          ) : (
            <ul className="mos-list">
              {events.map((e) => (
                <li key={e.id} className="mos-list__item">
                  <span>
                    <strong>{ACTION_LABEL[e.action] ?? e.action}</strong>{' '}
                    <span className="mos-muted">· {e.resourceType}</span>
                    <br />
                    <span className="mos-muted">
                      {new Date(e.occurredAt).toISOString().slice(0, 16).replace('T', ' ')}
                      {e.authorizationDecisionId
                        ? ` · decisión ${e.authorizationDecisionId.slice(0, 10)}…`
                        : ''}
                    </span>
                  </span>
                  <Badge tone={e.outcome === 'allowed' ? 'success' : 'critical'}>
                    {e.outcome === 'allowed' ? 'Permitido' : 'Denegado'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </ClinicalCard>
      </div>
    </div>
  );
}
