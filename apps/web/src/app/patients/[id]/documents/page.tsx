import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientHeader, ClinicalCard, Badge, Button, Alert } from '@medical-os/design-system';
import {
  PatientRepository,
  DocumentRepository,
  hasPermission,
  resolveStorageProvider,
} from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';
import { DocumentForm } from './DocumentForm';
import { DocumentUploader } from './DocumentUploader';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) notFound();

  const db = getDb();
  const patient = await new PatientRepository(db, ctx).findById(id as PatientId);
  if (!patient) notFound();

  const documents = await new DocumentRepository(db, ctx).listForPatient(patient.id);
  const canWrite = hasPermission(ctx, 'patient.write');
  const storageConfigured = resolveStorageProvider(process.env).configured;

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
        <h1 className="mos-page__title">Documentos</h1>
        <p className="mos-page__subtitle">
          La BD guarda solo metadata + hash; el archivo va a storage privado (ADR-0003 §10)
        </p>

        <div className="mos-grid">
          <ClinicalCard title={`Documentos (${documents.length})`}>
            {documents.length === 0 ? (
              <p className="mos-muted">Sin documentos registrados.</p>
            ) : (
              <ul className="mos-list">
                {documents.map((d) => (
                  <li key={d.id} className="mos-list__item">
                    <span>
                      <strong>{d.title}</strong>
                      {d.documentDate ? (
                        <span className="mos-muted"> · {d.documentDate}</span>
                      ) : null}
                      <br />
                      <span className="mos-muted">
                        {d.contentType}
                        {d.contentHash ? ` · hash ${d.contentHash.slice(0, 10)}…` : ''}
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {d.status === 'stored' ? (
                        <Link href={`/api/patients/${patient.id}/documents/${d.id}/download`}>
                          <Button variant="ghost">Descargar</Button>
                        </Link>
                      ) : canWrite && storageConfigured ? (
                        <DocumentUploader documentId={d.id} />
                      ) : null}
                      <Badge tone={d.status === 'stored' ? 'success' : 'warning'}>
                        {d.status === 'stored' ? 'Almacenado' : 'Pendiente de carga'}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ClinicalCard>

          {canWrite ? (
            <DocumentForm patientId={patient.id} />
          ) : (
            <Alert severity="info" title="Solo lectura">
              Tu rol no puede registrar documentos (`patient.write`).
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
