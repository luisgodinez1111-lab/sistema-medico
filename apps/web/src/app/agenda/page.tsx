import Link from 'next/link';
import { ClinicalCard, Badge, Button, Alert } from '@medical-os/design-system';
import { AppointmentRepository, PatientRepository, hasPermission } from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName } from '@/lib/patient-format';
import { NewAppointmentForm } from './NewAppointmentForm';
import { checkInAppointmentAction, cancelAppointmentAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  booked: 'Agendada',
  arrived: 'En sala',
  fulfilled: 'Atendida',
  cancelled: 'Cancelada',
  'no-show': 'No asistió',
};
const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'critical'> = {
  booked: 'info',
  arrived: 'success',
  fulfilled: 'neutral',
  cancelled: 'critical',
  'no-show': 'warning',
};

function dayRange(dateStr: string | undefined): { start: Date; end: Date; iso: string } {
  const base =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return { start, end, iso };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const ctx = await getRequestContext();
  if (!ctx) {
    return (
      <div className="mos-page">
        <h1 className="mos-page__title">Agenda</h1>
        <Alert severity="critical" title="Sin contexto de tenant">
          No hay una membresía activa resuelta en el servidor.
        </Alert>
      </div>
    );
  }

  const db = getDb();
  const { start, end, iso } = dayRange(date);
  const appointments = await new AppointmentRepository(db, ctx).listForDay(start, end);
  const patientRepo = new PatientRepository(db, ctx);
  const withNames = await Promise.all(
    appointments.map(async (a) => ({
      appt: a,
      patient: await patientRepo.findById(a.patientId),
    })),
  );
  const canWrite = hasPermission(ctx, 'patient.write');

  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Agenda</h1>
      <p className="mos-page__subtitle">Citas del {iso} · datos reales desde Neon (R3)</p>

      <form action="/agenda" method="get" className="mos-searchbar" role="search">
        <input name="date" type="date" defaultValue={iso} aria-label="Fecha de la agenda" />
      </form>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="mos-grid">
        <ClinicalCard title={`Citas (${withNames.length})`}>
          {withNames.length === 0 ? (
            <p className="mos-muted">Sin citas para este día.</p>
          ) : (
            <ul className="mos-list">
              {withNames.map(({ appt, patient }) => (
                <li key={appt.id} className="mos-list__item">
                  <span>
                    <strong>{new Date(appt.startAt).toISOString().slice(11, 16)}</strong>{' '}
                    {patient ? (
                      <Link href={`/patients/${patient.id}`}>{fullPatientName(patient)}</Link>
                    ) : (
                      <span className="mos-muted">paciente</span>
                    )}
                    <br />
                    <span className="mos-muted">
                      {appt.durationMinutes} min{appt.reason ? ` · ${appt.reason}` : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <Badge tone={STATUS_TONE[appt.status] ?? 'neutral'}>
                      {STATUS_LABEL[appt.status] ?? appt.status}
                    </Badge>
                    {canWrite && appt.status === 'booked' ? (
                      <>
                        <form action={checkInAppointmentAction}>
                          <input type="hidden" name="id" value={appt.id} />
                          <Button type="submit" variant="secondary">
                            Check-in
                          </Button>
                        </form>
                        <form action={cancelAppointmentAction}>
                          <input type="hidden" name="id" value={appt.id} />
                          <Button type="submit" variant="ghost">
                            Cancelar
                          </Button>
                        </form>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ClinicalCard>

        {canWrite ? (
          <NewAppointmentForm />
        ) : (
          <Alert severity="info" title="Solo lectura">
            Tu rol no puede agendar (`patient.write`).
          </Alert>
        )}
      </div>
    </div>
  );
}
