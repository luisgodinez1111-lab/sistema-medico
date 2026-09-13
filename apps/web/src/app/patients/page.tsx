import Link from 'next/link';
import { ClinicalCard, Badge, Alert } from '@medical-os/design-system';
import { PatientRepository, hasPermission } from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';
import { NewPatientForm } from './NewPatientForm';

export const dynamic = 'force-dynamic';

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const ctx = await getRequestContext();

  if (!ctx) {
    return (
      <div className="mos-page">
        <h1 className="mos-page__title">Pacientes</h1>
        <Alert severity="critical" title="Sin contexto de tenant">
          No hay una membresía activa resuelta en el servidor. Ejecuta el seed.
        </Alert>
      </div>
    );
  }

  const repo = new PatientRepository(getDb(), ctx);
  const query = (q ?? '').trim();
  const patients = query ? await repo.search(query) : await repo.listRecent();
  const canWrite = hasPermission(ctx, 'patient.write');

  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Pacientes</h1>
      <p className="mos-page__subtitle">Datos reales desde Neon · tenant-scoped (NIVEL 2/3)</p>

      <form action="/patients" method="get" className="mos-searchbar" role="search">
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar por nombre, apellido, MRN o CURP…"
          aria-label="Buscar pacientes"
        />
      </form>

      <div style={{ height: 'var(--space-4)' }} />

      <div className="mos-grid">
        <ClinicalCard
          title={
            query
              ? `Resultados para “${query}” (${patients.length})`
              : `Pacientes recientes (${patients.length})`
          }
        >
          {patients.length === 0 ? (
            <p className="mos-muted">
              {query ? 'Sin coincidencias.' : 'Aún no hay pacientes. Crea el primero.'}
            </p>
          ) : (
            <ul className="mos-list">
              {patients.map((p) => (
                <li key={p.id}>
                  <Link className="mos-link-row" href={`/patients/${p.id}`}>
                    <span>
                      <strong>{fullPatientName(p)}</strong>{' '}
                      <span className="mos-muted">
                        · {ageLabel(p.birthDate)} · {sexLabel(p.sex)} · MRN {p.mrn}
                      </span>
                    </span>
                    <Badge tone="neutral">Ver</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClinicalCard>

        {canWrite ? (
          <NewPatientForm />
        ) : (
          <Alert severity="info" title="Solo lectura">
            Tu rol no tiene permiso para crear pacientes (`patient.write`).
          </Alert>
        )}
      </div>
    </div>
  );
}
