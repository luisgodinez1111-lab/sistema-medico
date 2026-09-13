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
  EncounterRepository,
  MedicationRepository,
  ServiceRequestRepository,
  DiagnosticReportRepository,
  hasCritical,
  hasPermission,
} from '@medical-os/db';
import type {
  PatientId,
  EncounterId,
  ServiceRequestId,
  DiagnosticReportId,
} from '@medical-os/shared';
import { ValidationError } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface SafetyAlertView {
  code: string;
  severity: 'critical' | 'warning';
  message: string;
}
export interface AllergyActionState {
  status: 'idle' | 'error' | 'ok' | 'alerts';
  message?: string;
  /** Alertas de seguridad de prescripción (§NIVEL 8), cuando aplica. */
  alerts?: SafetyAlertView[];
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

/**
 * Inicia una consulta: crea un encuentro en borrador y navega a su captura
 * (§NIVEL 6, §28 paso 4). Permiso `patient.write`.
 */
export async function startEncounterAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para iniciar consultas.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };

  const created = await new EncounterRepository(getDb(), ctx).create({ patientId });
  if (!created) return { status: 'error', message: 'No se pudo iniciar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/encounters/${created.id}`);
}

/** Guarda el borrador SOAP del encuentro (§NIVEL 6). Permiso `patient.write`. */
export async function saveEncounterDraftAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para editar la nota.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const encounterId = str(formData, 'encounterId') as EncounterId;
  if (!patientId || !encounterId) return { status: 'error', message: 'Datos inválidos.' };

  const updated = await new EncounterRepository(getDb(), ctx).updateDraft(encounterId, {
    reason: str(formData, 'reason'),
    subjective: str(formData, 'subjective'),
    objective: str(formData, 'objective'),
    assessment: str(formData, 'assessment'),
    plan: str(formData, 'plan'),
  });
  if (!updated) {
    return { status: 'error', message: 'No se pudo guardar (nota firmada o no válida).' };
  }

  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  return { status: 'ok', message: 'Borrador guardado.' };
}

/**
 * Firma el encuentro: congela snapshot + hash + provenance (§NIVEL 6, §28 paso
 * 10). Requiere el permiso específico `encounter.sign` (§NIVEL 2).
 */
export async function signEncounterAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'encounter.sign')) {
    return { status: 'error', message: 'No tienes permiso para firmar encuentros.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const encounterId = str(formData, 'encounterId') as EncounterId;
  if (!patientId || !encounterId) return { status: 'error', message: 'Datos inválidos.' };

  const signed = await new EncounterRepository(getDb(), ctx).sign(encounterId);
  if (!signed) {
    return { status: 'error', message: 'No se pudo firmar (ya firmado o no válido).' };
  }

  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  return { status: 'ok', message: 'Encuentro firmado.' };
}

/**
 * Prescribe un medicamento con chequeo de seguridad (§NIVEL 8, §28 paso 8).
 * Evalúa alergias y duplicidad; si hay una alerta CRÍTICA (alergia) y el usuario
 * no confirmó, NO prescribe y devuelve las alertas. Permiso `patient.write`.
 */
export async function prescribeMedicationAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para prescribir.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const drug = str(formData, 'drug');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!drug) return { status: 'error', message: 'Indica el medicamento.' };

  const confirm = str(formData, 'confirm') === '1';
  const repo = new MedicationRepository(getDb(), ctx);

  const alerts = await repo.checkSafety(patientId, drug);
  const alertViews = alerts.map((a) => ({
    code: a.code,
    severity: a.severity,
    message: a.message,
  }));

  // Una alerta crítica (alergia) bloquea salvo confirmación explícita.
  if (hasCritical(alerts) && !confirm) {
    return {
      status: 'alerts',
      message: 'Alerta de seguridad: revisa antes de prescribir.',
      alerts: alertViews,
    };
  }

  const dose = str(formData, 'dose');
  const route = str(formData, 'route') || 'oral';
  const frequency = str(formData, 'frequency');
  const duration = str(formData, 'durationDays');
  const created = await repo.prescribe({
    patientId,
    drug,
    route: route as 'oral' | 'iv' | 'im' | 'sc' | 'topical' | 'inhaled' | 'other',
    ...(dose ? { dose } : {}),
    ...(frequency ? { frequency } : {}),
    ...(duration ? { durationDays: duration } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo prescribir (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  const warn = alertViews.filter((a) => a.severity === 'warning');
  return {
    status: 'ok',
    message: warn.length ? 'Prescrito (con advertencias de duplicidad).' : 'Medicamento prescrito.',
    ...(warn.length ? { alerts: warn } : {}),
  };
}

/** Solicita un estudio de laboratorio/imagen (§NIVEL 9, §28 paso 9). */
export async function orderStudyAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para solicitar estudios.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const code = str(formData, 'code');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!code) return { status: 'error', message: 'Indica el estudio.' };

  const category = (str(formData, 'category') || 'laboratory') as
    'laboratory' | 'imaging' | 'procedure';
  const priority = (str(formData, 'priority') || 'routine') as 'routine' | 'urgent';
  const created = await new ServiceRequestRepository(getDb(), ctx).create({
    patientId,
    code,
    category,
    priority,
  });
  if (!created) return { status: 'error', message: 'No se pudo solicitar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Estudio solicitado.' };
}

/** Ingresa el resultado de un estudio (§NIVEL 9, §28 paso 11). */
export async function enterResultAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para ingresar resultados.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const serviceRequestId = str(formData, 'serviceRequestId') as ServiceRequestId;
  const code = str(formData, 'code');
  const value = str(formData, 'value');
  if (!patientId || !code) return { status: 'error', message: 'Datos inválidos.' };
  if (!value) return { status: 'error', message: 'Indica el valor del resultado.' };

  const abnormalFlag = (str(formData, 'abnormalFlag') || 'normal') as
    'normal' | 'low' | 'high' | 'critical';
  const created = await new DiagnosticReportRepository(getDb(), ctx).enterResult({
    patientId,
    code,
    value,
    abnormalFlag,
    ...(serviceRequestId ? { serviceRequestId } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Resultado ingresado.' };
}

/**
 * Cierra la obligación clínica de un resultado: revisado + acción + paciente
 * informado (§NIVEL 9, §28 pasos 13-14).
 */
export async function reviewResultAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para revisar resultados.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const reportId = str(formData, 'reportId') as DiagnosticReportId;
  const action = str(formData, 'action');
  if (!patientId || !reportId) return { status: 'error', message: 'Datos inválidos.' };
  if (!action) return { status: 'error', message: 'Indica la acción tomada.' };

  const reviewed = await new DiagnosticReportRepository(getDb(), ctx).markReviewed(reportId, {
    action,
    patientInformed: str(formData, 'patientInformed') === 'on',
  });
  if (!reviewed)
    return { status: 'error', message: 'No se pudo cerrar (ya revisado o no válido).' };

  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/');
  return { status: 'ok', message: 'Resultado revisado y obligación cerrada.' };
}
