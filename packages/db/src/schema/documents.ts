import { pgTable, pgEnum, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { DocumentId, PatientId, TenantId, UserId } from '@medical-os/shared';

/**
 * Documentos clínicos (Release R5). La BD guarda SOLO metadata + content hash +
 * la clave en object storage; NUNCA los bytes del archivo ni URLs públicas
 * (ADR-0003 §10, §33 #5). El archivo vive en storage privado; el acceso se hace
 * con signed URLs de corta duración o proxy autorizado (pendiente de wiring).
 *
 * `status` distingue el registro de metadata (pending-upload) del archivo ya
 * almacenado (stored). `storage_provider` = 'unconfigured' hasta conectar bucket.
 */
export const documentStatus = pgEnum('document_status', ['pending-upload', 'stored']);

export const clinicalDocument = pgTable(
  'clinical_document',
  {
    id: text('id').primaryKey().$type<DocumentId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),

    title: text('title').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes'),
    /** Hash de integridad del contenido (SHA-256 hex) cuando está almacenado. */
    contentHash: text('content_hash'),
    /** Clave en el object storage privado (no es URL pública). */
    storageKey: text('storage_key'),
    storageProvider: text('storage_provider').notNull().default('unconfigured'),
    status: documentStatus('status').notNull().default('pending-upload'),

    uploadedBy: text('uploaded_by').$type<UserId>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('clinical_document_tenant_idx').on(t.tenantId),
    index('clinical_document_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);
