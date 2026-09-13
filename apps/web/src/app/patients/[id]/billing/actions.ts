'use server';

import { revalidatePath } from 'next/cache';
import { BillingRepository, hasPermission } from '@medical-os/db';
import type { PatientId, InvoiceId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';
import { pesosToCents } from '@/lib/money';

export interface BillingActionState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/** Crea una factura básica (una línea) en borrador (R3). Permiso `patient.write`. */
export async function createInvoiceAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para facturar.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const description = str(formData, 'description');
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!description) return { status: 'error', message: 'Indica el concepto.' };

  const quantity = Math.max(1, Number.parseInt(str(formData, 'quantity') || '1', 10) || 1);
  const unitPriceCents = pesosToCents(str(formData, 'unitPrice'));
  if (unitPriceCents <= 0) return { status: 'error', message: 'Indica un precio válido.' };

  const created = await new BillingRepository(getDb(), ctx).createInvoice({
    patientId,
    items: [{ description, quantity, unitPriceCents }],
  });
  if (!created) return { status: 'error', message: 'No se pudo crear la factura.' };

  revalidatePath(`/patients/${patientId}/billing`);
  return { status: 'ok', message: 'Factura creada (borrador).' };
}

/** Emite una factura (draft → issued). */
export async function issueInvoiceAction(formData: FormData): Promise<void> {
  const ctx = await getRequestContext();
  if (!ctx || !hasPermission(ctx, 'patient.write')) return;
  const id = str(formData, 'id') as InvoiceId;
  const patientId = str(formData, 'patientId');
  if (id) await new BillingRepository(getDb(), ctx).issue(id);
  if (patientId) revalidatePath(`/patients/${patientId}/billing`);
}

/** Marca una factura como pagada (issued → paid). */
export async function payInvoiceAction(formData: FormData): Promise<void> {
  const ctx = await getRequestContext();
  if (!ctx || !hasPermission(ctx, 'patient.write')) return;
  const id = str(formData, 'id') as InvoiceId;
  const patientId = str(formData, 'patientId');
  if (id) await new BillingRepository(getDb(), ctx).markPaid(id);
  if (patientId) revalidatePath(`/patients/${patientId}/billing`);
}
