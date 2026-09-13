'use server';

import { revalidatePath } from 'next/cache';
import {
  DocumentRepository,
  AuditRepository,
  hasPermission,
  resolveStorageProvider,
  documentStorageKey,
} from '@medical-os/db';
import type { PatientId, DocumentId } from '@medical-os/shared';
import { getRequestContext } from '@/server/context';
import { getDb } from '@/server/db';

export interface DocActionState {
  status: 'idle' | 'error' | 'ok';
  message?: string;
}

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? '').toString().trim();
}

/** Proveedor de object storage resuelto desde el entorno (§R5). */
function storage() {
  return resolveStorageProvider(process.env);
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

  const provider = storage();
  const created = await new DocumentRepository(getDb(), ctx).register({
    patientId,
    title,
    contentType,
    storageProvider: provider.provider,
  });
  if (!created) return { status: 'error', message: 'No se pudo registrar (paciente no válido).' };

  revalidatePath(`/patients/${patientId}/documents`);
  return {
    status: 'ok',
    message: provider.configured
      ? 'Documento registrado. Puedes subir el archivo.'
      : 'Documento registrado (metadata). Almacenamiento no configurado: pendiente de carga.',
  };
}

/** Resultado de solicitar una URL de subida prefirmada. */
export interface UploadTarget {
  ok: boolean;
  url?: string;
  key?: string;
  method?: 'PUT';
  message?: string;
}

/**
 * Devuelve una URL prefirmada (PUT, corta duración) para subir el archivo de un
 * documento ya registrado. NO transporta bytes por el servidor. Requiere
 * `patient.write` y que el documento pertenezca al tenant. Audita la solicitud.
 */
export async function requestUploadTarget(documentId: string): Promise<UploadTarget> {
  const ctx = await getRequestContext();
  if (!ctx) return { ok: false, message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { ok: false, message: 'No tienes permiso para subir documentos.' };
  }
  const db = getDb();
  const repo = new DocumentRepository(db, ctx);
  const doc = await repo.findById(documentId as DocumentId);
  if (!doc) return { ok: false, message: 'Documento no encontrado.' };

  const provider = storage();
  if (!provider.configured) {
    return { ok: false, message: 'Almacenamiento no configurado.' };
  }
  const key = documentStorageKey(ctx.tenantId, doc.patientId, doc.id);
  const target = provider.presignUpload(key, doc.contentType);
  if (!target.ok) return { ok: false, message: target.error.message };

  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'clinical-document',
    resourceId: doc.id,
    patientId: doc.patientId,
    payload: { phase: 'upload-presign', provider: provider.provider, key },
  });

  return { ok: true, url: target.value.url, key: target.value.key, method: 'PUT' };
}

/**
 * Sella el documento como almacenado tras una subida exitosa: guarda hash de
 * integridad (SHA-256 calculado en el cliente sobre el mismo archivo), clave y
 * tamaño. Requiere `patient.write`. Audita el sellado.
 */
export async function finalizeDocument(
  documentId: string,
  contentHash: string,
  sizeBytes: number,
): Promise<DocActionState> {
  const ctx = await getRequestContext();
  if (!ctx) return { status: 'error', message: 'Sin sesión válida.' };
  if (!hasPermission(ctx, 'patient.write')) {
    return { status: 'error', message: 'No tienes permiso para subir documentos.' };
  }
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    return { status: 'error', message: 'Hash de integridad inválido.' };
  }
  const db = getDb();
  const repo = new DocumentRepository(db, ctx);
  const doc = await repo.findById(documentId as DocumentId);
  if (!doc) return { status: 'error', message: 'Documento no encontrado.' };

  const provider = storage();
  const key = documentStorageKey(ctx.tenantId, doc.patientId, doc.id);
  const sealed = await repo.markStored(doc.id, {
    contentHash,
    storageKey: key,
    storageProvider: provider.provider,
    sizeBytes,
  });
  if (!sealed) return { status: 'error', message: 'No se pudo sellar el documento.' };

  await new AuditRepository(db, ctx).record({
    action: 'update',
    outcome: 'allowed',
    resourceType: 'clinical-document',
    resourceId: doc.id,
    patientId: doc.patientId,
    payload: { phase: 'stored', provider: provider.provider, contentHash, sizeBytes },
  });

  revalidatePath(`/patients/${doc.patientId}/documents`);
  return { status: 'ok', message: 'Archivo almacenado y sellado con hash de integridad.' };
}
