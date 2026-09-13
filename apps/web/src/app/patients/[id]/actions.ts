'use server';

import { revalidatePath } from 'next/cache';
import { AllergyRepository, hasPermission } from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface AllergyActionState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/**
 * Registra una alergia del paciente (§NIVEL 3). Autorización server-side
 * (`patient.write`), validación y scoping por tenant en el repositorio.
 */
export async function addAllergyAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para registrar alergias.' };
  }

  const patientId = str(formData, 'patientId') as PatientId;
  const substance = str(formData, 'substance');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!substance) return { status: 'error', message: 'Indica la sustancia.' };

  const category = (str(formData, 'category') || 'medication') as
    'medication' | 'food' | 'environment' | 'biologic' | 'other';
  const criticality = (str(formData, 'criticality') || 'unable-to-assess') as
    'low' | 'high' | 'unable-to-assess';
  const reaction = str(formData, 'reaction');

  const created = await new AllergyRepository(getDb(), ctx).create({
    patientId,
    substance,
    category,
    criticality,
    ...(reaction ? { reaction } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Alergia registrada.' };
}

/**
 * Marca el estado de alergias como revisado sin registrar ninguna (NKDA
 * explícito): distingue "sin alergias conocidas" de "no evaluado" (§27).
 */
export async function markNoKnownAllergiesAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };

  const ok = await new AllergyRepository(getDb(), ctx).markReviewed(patientId);
  if (!ok) return { status: 'error', message: 'Paciente no válido.' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Marcado sin alergias conocidas.' };
}
