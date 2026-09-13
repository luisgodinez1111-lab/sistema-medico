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
  AuditRepository,
  hasPermission,
  buildPatientBundle,
  parseFhirBundle,
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

/**
 * Importa un Bundle FHIR R4 y adjunta sus recursos clínicos (alergias, problemas,
 * observaciones) al paciente indicado del tenant (§R5, adaptador de entrada). El
 * recurso Patient del Bundle se ignora: el import se hace SOBRE un paciente ya
 * resuelto (evita alta ciega y duplicados). Requiere `patient.write`. Audita el
 * import con conteos, nunca PHI en claro. 404 cross-tenant (§27).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await getRequestContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasPermission(ctx, 'patient.write')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const db = getDb();
  const patientId = id as PatientId;
  const patient = await new PatientRepository(db, ctx).findById(patientId);
  if (!patient) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = parseFhirBundle(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'invalid_fhir', message: parsed.error.message },
      { status: 422 },
    );
  }

  const allergyRepo = new AllergyRepository(db, ctx);
  const conditionRepo = new ConditionRepository(db, ctx);
  const observationRepo = new ObservationRepository(db, ctx);
  const imported = { allergies: 0, conditions: 0, observations: 0 };

  for (const a of parsed.value.allergies) {
    if (await allergyRepo.create({ ...a, patientId })) imported.allergies += 1;
  }
  for (const c of parsed.value.conditions) {
    if (await conditionRepo.create({ ...c, patientId })) imported.conditions += 1;
  }
  for (const o of parsed.value.observations) {
    if (await observationRepo.create({ ...o, patientId })) imported.observations += 1;
  }

  await new AuditRepository(db, ctx).record({
    action: 'create',
    outcome: 'allowed',
    resourceType: 'fhir-import',
    resourceId: patient.id,
    patientId: patient.id,
    payload: {
      imported,
      skipped: parsed.value.skipped,
      patientResourceIgnored: Boolean(parsed.value.patient),
    },
  });

  return NextResponse.json(
    { status: 'ok', imported, skipped: parsed.value.skipped },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
