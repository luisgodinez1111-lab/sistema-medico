import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientHeader, ClinicalCard, Badge, Button, Alert } from '@medical-os/design-system';
import {
  PatientRepository,
  EncounterRepository,
  ExamRepository,
  EXAM_SECTIONS,
  ConditionRepository,
  EncounterDiagnosisRepository,
  EncounterAddendumRepository,
  hasPermission,
} from '@medical-os/db';
import type { PatientId, EncounterId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';
import { EncounterEditor } from './EncounterEditor';
import { ExamManager } from './ExamManager';
import { DiagnosisManager } from './DiagnosisManager';
import { AddendumManager } from './AddendumManager';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  'medicina-general': 'Medicina general',
  seguimiento: 'Seguimiento',
  urgencia: 'Urgencia',
  teleconsulta: 'Teleconsulta',
};

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ id: string; eid: string }>;
}) {
  const { id, eid } = await params;
  const ctx = await getRequestContext();
  if (!ctx) notFound();

  const db = getDb();
  const patient = await new PatientRepository(db, ctx).findById(id as PatientId);
  if (!patient) notFound();
  const encounter = await new EncounterRepository(db, ctx).getById(eid as EncounterId);
  if (!encounter || encounter.patientId !== patient.id) notFound();

  const signed = encounter.status === 'signed';
  const examFindings = signed
    ? []
    : await new ExamRepository(db, ctx).listForEncounter(encounter.id);
  const activeConditions = signed
    ? []
    : await new ConditionRepository(db, ctx).listActive(patient.id);
  const encounterDiagnoses = signed
    ? []
    : await new EncounterDiagnosisRepository(db, ctx).listForEncounter(encounter.id);
  const addenda = signed
    ? await new EncounterAddendumRepository(db, ctx).listForEncounter(encounter.id)
    : [];

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
        <p className="mos-page__subtitle">
          {TYPE_LABEL[encounter.type] ?? encounter.type} ·{' '}
          {signed ? <Badge tone="success">Firmado</Badge> : <Badge tone="warning">Borrador</Badge>}
        </p>

        {signed ? (
          <ClinicalCard title="Nota firmada (inmutable)">
            <Alert severity="success" title="Encuentro firmado">
              Firmado el {encounter.signedAt?.toISOString().slice(0, 16).replace('T', ' ')} · hash
              de integridad <code>{encounter.signedHash?.slice(0, 16)}…</code>
            </Alert>
            <ul className="mos-list" style={{ marginTop: 'var(--space-3)' }}>
              <li className="mos-list__item">
                <span>Motivo</span>
                <span>{encounter.reason ?? '—'}</span>
              </li>
              <li className="mos-list__item">
                <span>S — Subjetivo</span>
                <span>{encounter.subjective ?? '—'}</span>
              </li>
              <li className="mos-list__item">
                <span>O — Objetivo</span>
                <span>{encounter.objective ?? '—'}</span>
              </li>
              <li className="mos-list__item">
                <span>A — Análisis</span>
                <span>{encounter.assessment ?? '—'}</span>
              </li>
              <li className="mos-list__item">
                <span>P — Plan</span>
                <span>{encounter.plan ?? '—'}</span>
              </li>
            </ul>
          </ClinicalCard>
        ) : null}

        {signed ? (
          <>
            <div style={{ height: 'var(--space-4)' }} />
            <AddendumManager
              patientId={patient.id}
              encounterId={encounter.id}
              addenda={addenda.map((a) => ({
                id: a.id,
                text: a.text,
                createdAt:
                  a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
              }))}
              canAmend={hasPermission(ctx, 'encounter.sign')}
            />
          </>
        ) : null}

        {signed ? null : (
          <>
            <EncounterEditor
              patientId={patient.id}
              encounter={{
                id: encounter.id,
                reason: encounter.reason,
                subjective: encounter.subjective,
                objective: encounter.objective,
                assessment: encounter.assessment,
                plan: encounter.plan,
              }}
              canSign={hasPermission(ctx, 'encounter.sign')}
            />
            <div style={{ height: 'var(--space-4)' }} />
            <ExamManager
              patientId={patient.id}
              encounterId={encounter.id}
              sections={EXAM_SECTIONS.map((s) => ({ section: s.section, title: s.title }))}
              findings={examFindings.map((f) => ({
                section: f.section,
                normal: f.normal,
                note: f.note,
              }))}
            />
            <div style={{ height: 'var(--space-4)' }} />
            <DiagnosisManager
              patientId={patient.id}
              encounterId={encounter.id}
              conditions={activeConditions.map((c) => ({ id: c.id, code: c.code }))}
              selectedIds={encounterDiagnoses.map((d) => d.conditionId)}
            />
          </>
        )}
      </div>
    </div>
  );
}
