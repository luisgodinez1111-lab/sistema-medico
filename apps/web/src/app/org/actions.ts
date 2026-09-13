'use server';

import { revalidatePath } from 'next/cache';
import { SpecialtyRepository, AuditRepository, hasPermission } from '@medical-os/db';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface SpecialtyState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

/**
 * Fija la especialidad clínica del tenant (R7). Requiere `organization.manage`.
 * Audita el cambio (sin PHI). El pack se valida en el repositorio.
 */
export async function setSpecialtyAction(
  _prev: SpecialtyState,
  formData: FormData,
): Promise<SpecialtyState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'organization.manage')) {
    return { status: 'error', message: 'No tienes permiso para cambiar la especialidad.' };
  }
  const packId = (formData.get('packId') ?? '').toString().trim();
  if (!packId) return { status: 'error', message: 'Elige una especialidad.' };

  const db = getDb();
  const ok = await new SpecialtyRepository(db, ctx).setActivePack(packId);
  if (!ok) return { status: 'error', message: 'Especialidad no válida.' };

  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'tenant-specialty',
    payload: { packId },
  });

  revalidatePath('/org');
  return { status: 'ok', message: 'Especialidad de la clínica actualizada.' };
}
