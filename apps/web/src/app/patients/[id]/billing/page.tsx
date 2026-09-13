import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientHeader, ClinicalCard, Badge, Button, Alert } from '@medical-os/design-system';
import { PatientRepository, BillingRepository, hasPermission } from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';
import { formatMoney } from '@/lib/money';
import { NewInvoiceForm } from './NewInvoiceForm';
import { issueInvoiceAction, payInvoiceAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  paid: 'Pagada',
  void: 'Anulada',
};
const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'critical'> = {
  draft: 'neutral',
  issued: 'info',
  paid: 'success',
  void: 'critical',
};

export default async function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) notFound();

  const db = getDb();
  const patient = await new PatientRepository(db, ctx).findById(id as PatientId);
  if (!patient) notFound();

  const repo = new BillingRepository(db, ctx);
  const invoices = await repo.listForPatient(patient.id);
  const canWrite = hasPermission(ctx, 'patient.write');

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
        <h1 className="mos-page__title">Facturación</h1>
        <p className="mos-page__subtitle">Módulo separado de lo clínico (§33) · montos en MXN</p>

        <div className="mos-grid">
          <ClinicalCard title={`Facturas (${invoices.length})`}>
            {invoices.length === 0 ? (
              <p className="mos-muted">Sin facturas.</p>
            ) : (
              <ul className="mos-list">
                {invoices.map((inv) => (
                  <li key={inv.id} className="mos-list__item">
                    <span>
                      <strong>{formatMoney(inv.totalCents, inv.currency)}</strong>
                      <br />
                      <span className="mos-muted">
                        {new Date(inv.createdAt).toISOString().slice(0, 10)}
                      </span>
                    </span>
                    <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <Badge tone={STATUS_TONE[inv.status] ?? 'neutral'}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                      {canWrite && inv.status === 'draft' ? (
                        <form action={issueInvoiceAction}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="patientId" value={patient.id} />
                          <Button type="submit" variant="secondary">
                            Emitir
                          </Button>
                        </form>
                      ) : null}
                      {canWrite && inv.status === 'issued' ? (
                        <form action={payInvoiceAction}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="patientId" value={patient.id} />
                          <Button type="submit" variant="primary">
                            Marcar pagada
                          </Button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ClinicalCard>

          {canWrite ? (
            <NewInvoiceForm patientId={patient.id} />
          ) : (
            <Alert severity="info" title="Solo lectura">
              Tu rol no puede facturar (`patient.write`).
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
