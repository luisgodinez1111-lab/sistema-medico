import { NextResponse } from 'next/server';
import { PatientRepository } from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { fullPatientName, ageLabel, sexLabel } from '@/lib/patient-format';

export const dynamic = 'force-dynamic';

/**
 * Búsqueda de pacientes para el Command Palette (§NIVEL 1). Tenant-scoped
 * server-side: la autorización y el aislamiento ocurren aquí, nunca en el
 * cliente (ADR-0002). No cachea (PHI, §33).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const ctx = await getRequestContext();
  if (!ctx) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q === '') return NextResponse.json({ results: [] });

  const patients = await new PatientRepository(getDb(), ctx).search(q, 8);
  const results = patients.map((p) => ({
    id: p.id,
    name: fullPatientName(p),
    meta: `${ageLabel(p.birthDate)} · ${sexLabel(p.sex)} · MRN ${p.mrn}`,
  }));

  return NextResponse.json({ results }, { headers: { 'cache-control': 'private, no-store' } });
}
