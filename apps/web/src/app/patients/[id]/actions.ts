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
  AuditRepository,
  SpecialtyRepository,
  resolveSpecialtyPack,
  ExamRepository,
  EXAM_SECTIONS,
  composeExamObjective,
  EncounterDiagnosisRepository,
  composeAssessment,
  EncounterAddendumRepository,
  ConsentRepository,
  TaskRepository,
  generateSuggestions,
  hasCritical,
  hasPermission,
} from '@medical-os/db';
import type {
  PatientId,
  EncounterId,
  ServiceRequestId,
  DiagnosticReportId,
  ConditionId,
  ConsentId,
  TaskId,
} from '@medical-os/shared';
import { ValidationError } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { auditedAuthorize } from '@/server/audit';

export interface SafetyAlertView {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  source?: 'rule' | 'demo';
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

  // `objective` (O) NO se edita aquí: se deriva de la exploración física
  // estructurada (§28 paso 6) vía saveExamAction.
  // `objective` (O) y `assessment` (A) se derivan de la exploración y los
  // diagnósticos del encuentro (§28 pasos 6-7); aquí sólo S, P y motivo.
  const updated = await new EncounterRepository(getDb(), ctx).updateDraft(encounterId, {
    reason: str(formData, 'reason'),
    subjective: str(formData, 'subjective'),
    plan: str(formData, 'plan'),
  });
  if (!updated) {
    return { status: 'error', message: 'No se pudo guardar (nota firmada o no válida).' };
  }

  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  return { status: 'ok', message: 'Borrador guardado.' };
}

/**
 * Guarda la exploración física estructurada (§28 paso 6) y DERIVA el Objetivo (O)
 * de la nota SOAP a partir de los hallazgos, para que la firma + hash lo cubran.
 * Cada sección se envía como `status_<section>` ('' | 'normal' | 'abnormal') y
 * `note_<section>`. Permiso `patient.write`; sólo sobre borrador.
 */
export async function saveExamAction(
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

  const db = getDb();
  const examRepo = new ExamRepository(db, ctx);
  let wrote = false;
  for (const s of EXAM_SECTIONS) {
    const status = str(formData, `status_${s.section}`);
    if (status !== 'normal' && status !== 'abnormal') continue;
    const ok = await examRepo.setFinding({
      encounterId,
      patientId,
      section: s.section,
      normal: status === 'normal',
      note: str(formData, `note_${s.section}`),
    });
    if (!ok) return { status: 'error', message: 'No se pudo guardar (nota firmada o no válida).' };
    wrote = true;
  }
  if (!wrote) return { status: 'error', message: 'Marca al menos una sección explorada.' };

  // Deriva el Objetivo (O) de los hallazgos y lo escribe en el encuentro.
  const findings = await examRepo.listForEncounter(encounterId);
  const objective = composeExamObjective(
    findings.map((f) => ({ section: f.section, normal: f.normal, note: f.note })),
  );
  await new EncounterRepository(db, ctx).updateDraft(encounterId, { objective });

  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  return { status: 'ok', message: 'Exploración guardada.' };
}

/**
 * Guarda los diagnósticos del encuentro (§28 paso 7) y DERIVA el Análisis (A) de
 * la nota SOAP. Los diagnósticos son Conditions del paciente marcadas como
 * abordadas hoy. Permiso `patient.write`; sólo sobre borrador.
 */
export async function saveEncounterDiagnosesAction(
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

  const conditionIds = formData
    .getAll('conditionId')
    .map((v) => v.toString().trim())
    .filter(Boolean) as ConditionId[];

  const db = getDb();
  const repo = new EncounterDiagnosisRepository(db, ctx);
  const ok = await repo.setDiagnoses(encounterId, patientId, conditionIds);
  if (!ok) return { status: 'error', message: 'No se pudo guardar (nota firmada o no válida).' };

  const diagnoses = await repo.listForEncounter(encounterId);
  const assessment = composeAssessment(diagnoses.map((d) => ({ code: d.code })));
  await new EncounterRepository(db, ctx).updateDraft(encounterId, { assessment });

  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  return { status: 'ok', message: 'Diagnósticos guardados.' };
}

/**
 * Añade una enmienda (addendum) a un encuentro FIRMADO (§NIVEL 6, §33 #6). La nota
 * original permanece inmutable; la enmienda se anexa fechada y atribuida. Requiere
 * autoridad de firma (`encounter.sign`). Auditado vía provenance en el repositorio.
 */
export async function addAddendumAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'encounter.sign')) {
    return { status: 'error', message: 'No tienes permiso para enmendar la nota.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const encounterId = str(formData, 'encounterId') as EncounterId;
  const text = str(formData, 'text');
  if (!patientId || !encounterId) return { status: 'error', message: 'Datos inválidos.' };
  if (!text) return { status: 'error', message: 'Escribe la enmienda.' };

  const created = await new EncounterAddendumRepository(getDb(), ctx).add(
    encounterId,
    patientId,
    text,
  );
  if (!created) {
    return { status: 'error', message: 'No se pudo enmendar (la nota debe estar firmada).' };
  }

  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`);
  return { status: 'ok', message: 'Enmienda agregada.' };
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
  const patientId = str(formData, 'patientId') as PatientId;
  const encounterId = str(formData, 'encounterId') as EncounterId;
  if (!patientId || !encounterId) return { status: 'error', message: 'Datos inválidos.' };
  if (
    !(await auditedAuthorize(ctx, 'encounter.sign', {
      action: 'sign',
      resourceType: 'encounter',
      resourceId: encounterId,
      patientId,
    }))
  ) {
    return { status: 'error', message: 'No tienes permiso para firmar encuentros.' };
  }

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
  const patientId = str(formData, 'patientId') as PatientId;
  const drug = str(formData, 'drug');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!drug) return { status: 'error', message: 'Indica el medicamento.' };
  if (
    !(await auditedAuthorize(ctx, 'patient.write', {
      action: 'create',
      resourceType: 'medication_request',
      patientId,
    }))
  ) {
    return { status: 'error', message: 'No tienes permiso para prescribir.' };
  }

  const confirm = str(formData, 'confirm') === '1';
  const repo = new MedicationRepository(getDb(), ctx);

  const alerts = await repo.checkSafety(patientId, drug);
  const alertViews = alerts.map((a) => ({
    code: a.code,
    severity: a.severity,
    message: a.message,
    source: a.source,
  }));

  // Cualquier alerta (crítica, advertencia o sugerencia de dosis) se muestra y
  // requiere confirmación explícita antes de prescribir (human-in-the-loop).
  if (alerts.length > 0 && !confirm) {
    return {
      status: 'alerts',
      message: hasCritical(alerts)
        ? 'Alerta CRÍTICA de seguridad: revisa antes de prescribir.'
        : 'Revisa las alertas y confirma para prescribir.',
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
  const patientId = str(formData, 'patientId') as PatientId;
  const code = str(formData, 'code');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!code) return { status: 'error', message: 'Indica el estudio.' };
  if (
    !(await auditedAuthorize(ctx, 'patient.write', {
      action: 'create',
      resourceType: 'service_request',
      patientId,
    }))
  ) {
    return { status: 'error', message: 'No tienes permiso para solicitar estudios.' };
  }

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

/** Resultado de una acción rápida (order set del pack de especialidad). */
export interface SpecialtyOrderResult {
  ok: boolean;
  message: string;
}

/**
 * Crea una ServiceRequest en UN CLIC a partir de un order set del pack de
 * especialidad activo (§R7). Defensa: el `itemCode` DEBE pertenecer al pack
 * activo del tenant (no acepta texto arbitrario). Requiere `patient.write`,
 * auditado; deja provenance del pack en la nota (contenido DEMO).
 */
export async function orderFromSpecialtyAction(
  patientId: string,
  itemCode: string,
): Promise<SpecialtyOrderResult> {
  const ctx = await getRequestContext();
  if (!ctx) return { ok: false, message: 'Sin sesión válida.' };
  const pid = patientId as PatientId;
  if (!pid || !itemCode) return { ok: false, message: 'Datos inválidos.' };

  if (
    !(await auditedAuthorize(ctx, 'patient.write', {
      action: 'create',
      resourceType: 'service_request',
      patientId: pid,
    }))
  ) {
    return { ok: false, message: 'No tienes permiso para solicitar órdenes.' };
  }

  const db = getDb();
  const pack = resolveSpecialtyPack(await new SpecialtyRepository(db, ctx).getActivePackId());
  const item = pack.orderSets.find((o) => o.code === itemCode);
  if (!item) return { ok: false, message: 'La orden no pertenece a la especialidad activa.' };

  const created = await new ServiceRequestRepository(db, ctx).create({
    patientId: pid,
    code: item.label,
    category: 'procedure',
    note: `Order set: ${pack.name} (DEMO, ${pack.version})`,
  });
  if (!created) return { ok: false, message: 'No se pudo crear la orden (paciente no válido).' };

  revalidatePath(`/patients/${pid}`);
  return { ok: true, message: `Orden creada: ${item.label}.` };
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
  const unit = str(formData, 'unit');
  const referenceLow = str(formData, 'referenceLow');
  const referenceHigh = str(formData, 'referenceHigh');
  const created = await new DiagnosticReportRepository(getDb(), ctx).enterResult({
    patientId,
    code,
    value,
    abnormalFlag,
    ...(unit ? { unit } : {}),
    ...(referenceLow ? { referenceLow } : {}),
    ...(referenceHigh ? { referenceHigh } : {}),
    ...(serviceRequestId ? { serviceRequestId } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Resultado ingresado.' };
}

/**
 * Otorga un consentimiento del paciente (§26 LFPDPPP/NOM-024). Requiere
 * `patient.write`; auditado. Tipo validado contra el catálogo.
 */
export async function grantConsentAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para registrar consentimientos.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const type = str(formData, 'type');
  const valid = ['privacy-notice', 'treatment', 'data-sharing', 'informed-procedure'];
  if (!patientId || !valid.includes(type)) return { status: 'error', message: 'Datos inválidos.' };

  const db = getDb();
  const created = await new ConsentRepository(db, ctx).grant({
    patientId,
    type: type as 'privacy-notice' | 'treatment' | 'data-sharing' | 'informed-procedure',
    ...(str(formData, 'note') ? { note: str(formData, 'note') } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  await new AuditRepository(db, ctx).record({
    action: 'create',
    outcome: 'allowed',
    resourceType: 'consent',
    resourceId: created.id,
    patientId,
    payload: { type },
  });
  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Consentimiento registrado.' };
}

/** Revoca un consentimiento activo (no borra; §26). Permiso `patient.write`, auditado. */
export async function revokeConsentAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para revocar consentimientos.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const consentId = str(formData, 'consentId') as ConsentId;
  if (!patientId || !consentId) return { status: 'error', message: 'Datos inválidos.' };

  const db = getDb();
  const ok = await new ConsentRepository(db, ctx).revoke(consentId);
  if (!ok) return { status: 'error', message: 'No se pudo revocar (ya revocado o no válido).' };

  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'consent',
    resourceId: consentId,
    patientId,
    payload: { revoked: true },
  });
  revalidatePath(`/patients/${patientId}`);
  return { status: 'ok', message: 'Consentimiento revocado.' };
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
  const patientId = str(formData, 'patientId') as PatientId;
  const reportId = str(formData, 'reportId') as DiagnosticReportId;
  const action = str(formData, 'action');
  if (!patientId || !reportId) return { status: 'error', message: 'Datos inválidos.' };
  if (!action) return { status: 'error', message: 'Indica la acción tomada.' };
  if (
    !(await auditedAuthorize(ctx, 'patient.write', {
      action: 'update',
      resourceType: 'diagnostic_report',
      resourceId: reportId,
      patientId,
    }))
  ) {
    return { status: 'error', message: 'No tienes permiso para revisar resultados.' };
  }

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

/**
 * Crea una obligación clínica (tarea) del paciente (§NIVEL 3, §NIVEL 9). Toda
 * tarea nace con dueño (el autor) y criterio de cierre. Permiso `patient.write`,
 * auditado. El paciente se valida contra el tenant en el repositorio.
 */
export async function createTaskAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para crear pendientes.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const title = str(formData, 'title');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!title) return { status: 'error', message: 'Describe el pendiente.' };

  const type = (str(formData, 'type') || 'clinical-followup') as
    'result-review' | 'clinical-followup' | 'arco-request' | 'general';
  const priority = (str(formData, 'priority') || 'routine') as 'routine' | 'urgent';
  const dueDate = str(formData, 'dueDate');

  const db = getDb();
  const created = await new TaskRepository(db, ctx).create({
    patientId,
    title,
    type,
    priority,
    ...(str(formData, 'note') ? { note: str(formData, 'note') } : {}),
    ...(dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? { dueDate } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo crear (paciente no válido).' };

  await new AuditRepository(db, ctx).record({
    action: 'create',
    outcome: 'allowed',
    resourceType: 'task',
    resourceId: created.id,
    patientId,
    payload: { type, priority },
  });
  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/');
  return { status: 'ok', message: 'Pendiente creado.' };
}

/** Cierra un pendiente como completado (atribuido y fechado; §NIVEL 9). */
export async function completeTaskAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para cerrar pendientes.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const taskId = str(formData, 'taskId') as TaskId;
  if (!patientId || !taskId) return { status: 'error', message: 'Datos inválidos.' };

  const db = getDb();
  const ok = await new TaskRepository(db, ctx).complete(taskId);
  if (!ok) return { status: 'error', message: 'No se pudo cerrar (ya cerrado o no válido).' };

  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'task',
    resourceId: taskId,
    patientId,
    payload: { status: 'completed' },
  });
  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/');
  return { status: 'ok', message: 'Pendiente cerrado.' };
}

/** Cancela un pendiente abierto (descartado con criterio, no borrado; §NIVEL 9). */
export async function cancelTaskAction(
  _prev: AllergyActionState,
  formData: FormData,
): Promise<AllergyActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para cancelar pendientes.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const taskId = str(formData, 'taskId') as TaskId;
  if (!patientId || !taskId) return { status: 'error', message: 'Datos inválidos.' };

  const db = getDb();
  const ok = await new TaskRepository(db, ctx).cancel(taskId);
  if (!ok) return { status: 'error', message: 'No se pudo cancelar (ya cerrado o no válido).' };

  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'task',
    resourceId: taskId,
    patientId,
    payload: { status: 'cancelled' },
  });
  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/');
  return { status: 'ok', message: 'Pendiente cancelado.' };
}

export interface CopilotSuggestionView {
  code: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning';
}
export interface CopilotState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
  suggestions?: CopilotSuggestionView[];
  engine?: string;
}

/**
 * Genera sugerencias del copiloto (§R6, human-in-the-loop). Carga SOLO contexto
 * mínimo server-side (problemas + alergias, sin PHI de identidad), genera con el
 * motor stub (DEMO) y registra provenance de IA (engine/policy/contextHash, sin
 * chain-of-thought, §14). NO escribe nada al expediente: el clínico decide.
 */
export async function generateCopilotAction(
  _prev: CopilotState,
  formData: FormData,
): Promise<CopilotState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.read') && !hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };

  const db = getDb();
  const [conditions, allergies] = await Promise.all([
    new ConditionRepository(db, ctx).listActive(patientId),
    new AllergyRepository(db, ctx).listForPatient(patientId),
  ]);
  const result = generateSuggestions({
    conditions: conditions.map((c) => ({ code: c.code })),
    allergies: allergies.map((a) => ({ substance: a.substance, criticality: a.criticality })),
  });

  // Provenance de IA: engine/policy/contextHash; NUNCA PHI ni chain-of-thought.
  await new AuditRepository(db, ctx).record({
    action: 'read',
    outcome: 'allowed',
    resourceType: 'ai-suggestion',
    patientId,
    payload: {
      engine: result.engine,
      policyVersion: result.policyVersion,
      contextHash: result.contextHash,
      suggestionCount: result.suggestions.length,
    },
  });

  return {
    status: 'ok',
    message: `${result.suggestions.length} sugerencia(s) · ${result.engine}`,
    suggestions: result.suggestions,
    engine: result.engine,
  };
}
