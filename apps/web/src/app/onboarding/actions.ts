'use server';

import { redirect } from 'next/navigation';
import { provisionTenant, userHasActiveTenant } from '@medical-os/db';
import type { UserId } from '@medical-os/shared';
import { getSessionUserId } from '@/server/context';
import { getDb } from '@/server/db';

export interface OnboardingState {
  status: 'idle' | 'error';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/**
 * Crea la clínica del usuario autenticado (§28 paso 1): tenant → organización →
 * consultorio → admin → médico. El usuario queda como ADMIN. Idempotencia y
 * unicidad de slug las garantiza `provisionTenant`. En éxito redirige al inicio.
 */
export async function createClinicAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const userId = await getSessionUserId();
  if (!userId) return { status: 'error', message: 'Sin sesión válida.' };

  const db = getDb();
  // Si ya tiene clínica, no rehace: va al inicio.
  if (await userHasActiveTenant(db, userId as UserId)) redirect('/');

  const tenantName = str(formData, 'tenantName');
  const orgName = str(formData, 'orgName') || tenantName;
  const facilityName = str(formData, 'facilityName') || 'Consultorio principal';
  const specialtyPackId = str(formData, 'specialtyPackId');
  const practitionerSpecialty = str(formData, 'practitionerSpecialty');
  if (!tenantName) return { status: 'error', message: 'Indica el nombre de la clínica.' };

  const result = await provisionTenant(db, {
    userId: userId as UserId,
    tenantName,
    tenantSlug: str(formData, 'tenantSlug') || tenantName,
    orgName,
    facilityName,
    ...(specialtyPackId ? { specialtyPackId } : {}),
    ...(practitionerSpecialty ? { practitionerSpecialty } : {}),
  });
  if (!result.ok) {
    return {
      status: 'error',
      message: result.error.clientSafe ? result.error.message : 'No se pudo crear la clínica.',
    };
  }

  redirect('/');
}
