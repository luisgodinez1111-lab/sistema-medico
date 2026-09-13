import { NextResponse } from 'next/server';
import {
  PatientRepository,
  AllergyRepository,
  ConditionRepository,
  ObservationRepository,
  MedicationRepository,
  EncounterRepository,
  ServiceRequestRepository,
  DiagnosticReportRepository,
  buildPatientBundle,
} from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export const dynamic = 'force-dynamic';

/**
 * Exporta el expediente del paciente como Bundle FHIR R4 (§R5). Tenant-scoped
 * server-side; no cachea (PHI, §33). 404 si el paciente no es del tenant
 * (no revela existencia cross-tenant, §27).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const patientId = id as PatientId;
  const patient = await new PatientRepository(db, ctx).findById(patientId);
  if (!patient) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [allergies, conditions, observations, medications, encounters, orders, reports] =
    await Promise.all([
      new AllergyRepository(db, ctx).listForPatient(patientId),
      new ConditionRepository(db, ctx).listAll(patientId),
      new ObservationRepository(db, ctx).listForPatient(patientId),
      new MedicationRepository(db, ctx).listActiveForPatient(patientId),
      new EncounterRepository(db, ctx).listForPatient(patientId),
      new ServiceRequestRepository(db, ctx).listForPatient(patientId),
      new DiagnosticReportRepository(db, ctx).listForPatient(patientId),
    ]);

  const bundle = buildPatientBundle({
    patient,
    allergies,
    conditions,
    observations,
    medications,
    encounters,
    orders,
    reports,
  });

  return NextResponse.json(bundle, {
    headers: {
      'cache-control': 'private, no-store',
      'content-type': 'application/fhir+json; charset=utf-8',
    },
  });
}
