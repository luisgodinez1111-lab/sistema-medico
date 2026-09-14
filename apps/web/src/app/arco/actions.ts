'use server';

import { revalidatePath } from 'next/cache';
import { ArcoRepository, PatientRepository, AuditRepository, hasPermission } from '@medical-os/db';
import type { ArcoRequestId, PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface ArcoState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/**
 * Registra una solicitud ARCO (§NIVEL 18, LFPDPPP). Permiso `privacy.manage`,
 * auditada. Si se indica un MRN, liga la solicitud al titular del expediente.
 */
export async function createArcoAction(_prev: ArcoState, formData: FormData): Promise<ArcoState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'privacy.manage')) {
    return { status: 'error', message: 'No tienes permiso para gestionar solicitudes ARCO.' };
  }

  const type = str(formData, 'type');
  const requesterName = str(formData, 'requesterName');
  const validTypes = ['access', 'rectification', 'cancellation', 'opposition'];
  if (!validTypes.includes(type))
    return { status: 'error', message: 'Tipo de solicitud inválido.' };
  if (!requesterName) return { status: 'error', message: 'Indica quién solicita.' };

  const db = getDb();

  // MRN opcional: liga al titular si existe en el tenant.
  let patientId: PatientId | undefined;
  const mrn = str(formData, 'mrn');
  if (mrn) {
    const matches = await new PatientRepository(db, ctx).search(mrn);
    const match = matches.find((p) => p.mrn === mrn);
    if (!match) return { status: 'error', message: `No se encontró un paciente con MRN ${mrn}.` };
    patientId = match.id;
  }

  const created = await new ArcoRepository(db, ctx).create({
    type: type as 'access' | 'rectification' | 'cancellation' | 'opposition',
    requesterName,
    requesterRelation:
      str(formData, 'requesterRelation') === 'representative' ? 'representative' : 'self',
    ...(patientId ? { patientId } : {}),
    ...(str(formData, 'requesterContact')
      ? { requesterContact: str(formData, 'requesterContact') }
      : {}),
    ...(str(formData, 'detail') ? { detail: str(formData, 'detail') } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar la solicitud.' };

  await new AuditRepository(db, ctx).record({
    action: 'create',
    outcome: 'allowed',
    resourceType: 'arco_request',
    resourceId: created.id,
    ...(patientId ? { patientId } : {}),
    payload: { type },
  });
  revalidatePath('/arco');
  return { status: 'ok', message: `Solicitud registrada. Plazo de respuesta: ${created.dueDate}.` };
}

/** Marca una solicitud como "en revisión". Permiso `privacy.manage`. */
export async function markArcoInReviewAction(
  _prev: ArcoState,
  formData: FormData,
): Promise<ArcoState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'privacy.manage')) {
    return { status: 'error', message: 'No tienes permiso.' };
  }
  const id = str(formData, 'id') as ArcoRequestId;
  if (!id) return { status: 'error', message: 'Solicitud inválida.' };
  const db = getDb();
  const ok = await new ArcoRepository(db, ctx).markInReview(id);
  if (!ok) return { status: 'error', message: 'No se pudo actualizar (ya avanzada o no válida).' };
  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'arco_request',
    resourceId: id,
    payload: { status: 'in-review' },
  });
  revalidatePath('/arco');
  return { status: 'ok', message: 'Solicitud en revisión.' };
}

/**
 * Resuelve una solicitud ARCO con desenlace + resolución (atribuida y fechada).
 * Permiso `privacy.manage`, auditada.
 */
export async function resolveArcoAction(_prev: ArcoState, formData: FormData): Promise<ArcoState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'privacy.manage')) {
    return { status: 'error', message: 'No tienes permiso.' };
  }
  const id = str(formData, 'id') as ArcoRequestId;
  const outcome = str(formData, 'outcome');
  const resolution = str(formData, 'resolution');
  const reject = str(formData, 'reject') === '1';
  const validOutcomes = ['granted', 'partially-granted', 'denied'];
  if (!id || !validOutcomes.includes(outcome)) {
    return { status: 'error', message: 'Datos inválidos.' };
  }
  if (!resolution) return { status: 'error', message: 'Describe la resolución.' };

  const db = getDb();
  const ok = await new ArcoRepository(db, ctx).resolve(id, {
    outcome: outcome as 'granted' | 'partially-granted' | 'denied',
    resolution,
    status: reject ? 'rejected' : 'completed',
  });
  if (!ok) return { status: 'error', message: 'No se pudo resolver (ya cerrada o no válida).' };
  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'arco_request',
    resourceId: id,
    payload: { status: reject ? 'rejected' : 'completed', outcome },
  });
  revalidatePath('/arco');
  return { status: 'ok', message: 'Solicitud resuelta.' };
}
