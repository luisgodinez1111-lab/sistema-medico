'use server';

import { revalidatePath } from 'next/cache';
import { PatientRepository, AppointmentRepository, hasPermission } from '@medical-os/db';
import type { AppointmentId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface AgendaActionState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/**
 * Agenda una cita (R3). Identifica al paciente por MRN (tenant-scoped) y crea la
 * cita. Autorización server-side (`patient.write`).
 */
export async function createAppointmentAction(
  _prev: AgendaActionState,
  formData: FormData,
): Promise<AgendaActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para agendar.' };
  }

  const mrn = str(formData, 'mrn');
  const startRaw = str(formData, 'startAt');
  if (!mrn) return { status: 'error', message: 'Indica el MRN del paciente.' };
  if (!startRaw) return { status: 'error', message: 'Indica la fecha y hora.' };
  const startAt = new Date(startRaw);
  if (Number.isNaN(startAt.getTime())) return { status: 'error', message: 'Fecha/hora inválida.' };

  const db = getDb();
  const repo = new PatientRepository(db, ctx);
  const patient = (await repo.search(mrn, 10)).find((p) => p.mrn === mrn);
  if (!patient) return { status: 'error', message: `No se encontró paciente con MRN ${mrn}.` };

  const duration = Number.parseInt(str(formData, 'durationMinutes') || '30', 10);
  const reason = str(formData, 'reason');
  const created = await new AppointmentRepository(db, ctx).create({
    patientId: patient.id,
    startAt,
    durationMinutes: Number.isFinite(duration) ? duration : 30,
    ...(reason ? { reason } : {}),
  });
  if (!created) return { status: 'error', message: 'No se pudo agendar.' };

  revalidatePath('/agenda');
  return { status: 'ok', message: 'Cita agendada.' };
}

/** Check-in de una cita (booked → arrived). */
export async function checkInAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await getRequestContext();
  if (!ctx || !hasPermission(ctx, 'patient.write')) return;
  const id = (formData.get('id') ?? '').toString() as AppointmentId;
  if (id) await new AppointmentRepository(getDb(), ctx).checkIn(id);
  revalidatePath('/agenda');
}

/** Cancela una cita. */
export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const ctx = await getRequestContext();
  if (!ctx || !hasPermission(ctx, 'patient.write')) return;
  const id = (formData.get('id') ?? '').toString() as AppointmentId;
  if (id) await new AppointmentRepository(getDb(), ctx).setStatus(id, 'cancelled');
  revalidatePath('/agenda');
}
