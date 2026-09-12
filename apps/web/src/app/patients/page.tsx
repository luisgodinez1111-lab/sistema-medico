import Link from 'next/link';
import { ClinicalCard, Badge } from '@medical-os/design-system';
import { listMockPatients } from '@/lib/mock-data';

export default function PatientsPage() {
  const patients = listMockPatients();
  return (
    <div className="mos-page">
      <h1 className="mos-page__title">Pacientes</h1>
      <p className="mos-page__subtitle">Búsqueda y detección de duplicados llegan en NIVEL 3.</p>
      <ClinicalCard title={`${patients.length} pacientes (demo)`}>
        <ul className="mos-list">
          {patients.map((p) => (
            <li key={p.id}>
              <Link className="mos-link-row" href={`/patients/${p.id}`}>
                <span>
                  <strong>{p.fullName}</strong>{' '}
                  <span className="mos-muted">
                    · {p.ageLabel} · {p.sexLabel} · MRN {p.mrn}
                  </span>
                </span>
                {p.allergies.length > 0 ? (
                  <Badge tone="critical">Alergia</Badge>
                ) : (
                  <Badge tone="neutral">NKDA</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </ClinicalCard>
    </div>
  );
}
