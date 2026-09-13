'use server';

import { revalidatePath } from 'next/cache';
import { DocumentRepository, hasPermission } from '@medical-os/db';
import type { PatientId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface DocActionState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/** Proveedor de storage configurado (stub por defecto hasta conectar bucket). */
function storageProvider(): string {
  return process.env.DOCUMENTS_STORAGE ?? 'unconfigured';
}

/**
 * Registra la metadata de un documento clínico (§R5, ADR-0003 §10). NO sube
 * bytes: el archivo irá al object storage privado cuando `DOCUMENTS_STORAGE`
 * esté configurado; hoy queda `pending-upload`. Permiso `patient.write`.
 */
export async function registerDocumentAction(
  _prev: DocActionState,
  formData: FormData,
): Promise<DocActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para registrar documentos.' };
  }
  const patientId = str(formData, 'patientId') as PatientId;
  const title = str(formData, 'title');
  const contentType = str(formData, 'contentType') || 'application/pdf';
  if (!patientId) return { status: 'error', message: 'Paciente inválido.' };
  if (!title) return { status: 'error', message: 'Indica el título del documento.' };

  const created = await new DocumentRepository(getDb(), ctx).register({
    patientId,
    title,
    contentType,
    storageProvider: storageProvider(),
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}/documents`);
  const stub = storageProvider() === 'unconfigured';
  return {
    status: 'ok',
    message: stub
      ? 'Documento registrado (metadata). Almacenamiento no configurado: pendiente de carga.'
      : 'Documento registrado.',
  };
}
