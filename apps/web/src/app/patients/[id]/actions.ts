'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  PatientRepository,
  AllergyRepository,
  ConditionRepository,
  ObservationRepository,
  RelatedPersonRepository,
  HistoryRepository,
  hasPermission,
} from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { ValidationError } from '@medical-os/shared';
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

/**
 * Registra un problema/diagnóstico del paciente (§NIVEL 3, §28 paso 7).
 * Autorización server-side (`patient.write`) y scoping por tenant.
 */
export async function addConditionAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para registrar problemas.' };
  }

  const patientId = str(formData, 'patientId') as PatientId;
  const code = str(formData, 'code');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!code) return { status: 'error', message: 'Indica el problema o diagnóstico.' };

  const onsetDate = str(formData, 'onsetDate');
  const created = await new ConditionRepository(getDb(), ctx).create({
    patientId,
    code,
    ...(onsetDate && /^\d{4}-\d{2}-\d{2}$/.test(onsetDate) ? { onsetDate } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Problema registrado.' };
}

/**
 * Registra un signo vital del paciente (§NIVEL 3, §28 paso 6).
 * Autorización server-side (`patient.write`) y scoping por tenant.
 */
export async function addVitalAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para registrar signos vitales.' };
  }

  const patientId = str(formData, 'patientId') as PatientId;
  const code = str(formData, 'code');
  const valueText = str(formData, 'valueText');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!code) return { status: 'error', message: 'Indica el signo vital.' };
  if (!valueText) return { status: 'error', message: 'Indica el valor.' };

  const unit = str(formData, 'unit');
  const created = await new ObservationRepository(getDb(), ctx).create({
    patientId,
    code,
    valueText,
    category: 'vital-signs',
    ...(unit ? { unit } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Signo vital registrado.' };
}

type RelationshipType =
  | 'mother'
  | 'father'
  | 'guardian'
  | 'spouse'
  | 'sibling'
  | 'child'
  | 'caregiver'
  | 'emergency-contact'
  | 'other';

/**
 * Registra una persona relacionada (contacto/tutor) del paciente (§NIVEL 3).
 * Autorización server-side (`patient.write`) y scoping por tenant.
 */
export async function addRelatedPersonAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para registrar contactos.' };
  }

  const patientId = str(formData, 'patientId') as PatientId;
  const name = str(formData, 'name');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!name) return { status: 'error', message: 'Indica el nombre del contacto.' };

  const relationship = (str(formData, 'relationship') || 'other') as RelationshipType;
  const phone = str(formData, 'phone');
  const isEmergencyContact = str(formData, 'isEmergencyContact') === 'on';

  const created = await new RelatedPersonRepository(getDb(), ctx).create({
    patientId,
    name,
    relationship,
    isEmergencyContact,
    ...(phone ? { phone } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Contacto registrado.' };
}

/**
 * Fusiona el paciente actual (duplicado) en el superviviente identificado por
 * su MRN (§28 paso 2, NIVEL 3). Reasigna datos clínicos y marca el duplicado.
 * En éxito navega al expediente superviviente.
 */
export async function mergePatientAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para fusionar pacientes.' };
  }

  const loserId = str(formData, 'loserId') as PatientId;
  const winnerMrn = str(formData, 'winnerMrn');
  if (!loserId) return { status: 'error', message: 'Paciente inválido.' };
  if (!winnerMrn) return { status: 'error', message: 'Indica el MRN del paciente superviviente.' };

  const repo = new PatientRepository(getDb(), ctx);
  const matches = await repo.search(winnerMrn);
  const winner = matches.find((p) => p.mrn === winnerMrn);
  if (!winner) {
    return { status: 'error', message: `No se encontró un paciente activo con MRN ${winnerMrn}.` };
  }
  if (winner.id === loserId) {
    return { status: 'error', message: 'El MRN corresponde al mismo paciente.' };
  }

  let winnerId: string;
  try {
    const result = await repo.merge({ loserId, winnerId: winner.id });
    if (!result) return { status: 'error', message: 'No se pudo fusionar (pacientes no válidos).' };
    winnerId = result.winner.id;
  } catch (error) {
    if (error instanceof ValidationError) return { status: 'error', message: error.message };
    throw error;
  }

  revalidatePath('/patients');
  redirect(`/patients/${winnerId}`);
}

/**
 * Guarda una SECCIÓN de la historia clínica adaptativa (§NIVEL 5). Recibe los
 * ítems de la sección (campos `item:<section>:<code>`) y hace upsert de cada uno
 * (valor vacío = baja lógica del ítem). Autorización server-side + scoping.
 */
export async function saveHistorySectionAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para editar la historia.' };
  }

  const patientId = str(formData, 'patientId') as PatientId;
  if (!patientId) return { status: 'error', message: 'Datos inválidos.' };

  const repo = new HistoryRepository(getDb(), ctx);
  // Campos de la forma "item:<section>:<code>".
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith('item:')) continue;
    const parts = key.split(':');
    if (parts.length < 3) continue;
    const section = parts[1]!;
    const code = parts.slice(2).join(':');
    const value = raw.toString();
    const result = await repo.setEntry({ patientId, section, code, value });
    if (result === null && value.trim() !== '') {
      // Sólo puede deberse a paciente inválido (el vacío no entra aquí).
      return { status: 'error', message: 'No se pudo guardar (paciente no válido).' };
    }
  }

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Historia actualizada.' };
}
