import { and, eq, isNull, desc } from 'drizzle-orm';
import { newDocumentId, type DocumentId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { clinicalDocument, patient } from '../schema';

export type ClinicalDocumentRow = (typeof clinicalDocument)['$inferSelect'];

export interface RegisterDocumentInput {
  patientId: PatientId;
  title: string;
  contentType: string;
  storageProvider?: string;
}

/**
 * Documentos clínicos (R5). Registra METADATA (nunca los bytes; ADR-0003 §10).
 * Tenant- y patient-scoped, baja lógica. El archivo se sube al object storage
 * privado aparte; `markStored` sella hash + clave cuando el storage esté wired.
 */
export class DocumentRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  private async assertPatientInTenant(patientId: PatientId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: patient.id })
      .from(patient)
      .where(
        and(
          eq(patient.id, patientId),
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listForPatient(patientId: PatientId): Promise<ClinicalDocumentRow[]> {
    const rows = await this.db
      .select()
      .from(clinicalDocument)
      .where(
        and(
          eq(clinicalDocument.tenantId, this.ctx.tenantId),
          eq(clinicalDocument.patientId, patientId),
          isNull(clinicalDocument.deletedAt),
        ),
      )
      .orderBy(desc(clinicalDocument.createdAt));
    return rows as ClinicalDocumentRow[];
  }

  /** Registra la metadata del documento (queda pending-upload). */
  async register(input: RegisterDocumentInput): Promise<ClinicalDocumentRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(clinicalDocument)
      .values({
        id: newDocumentId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        title: input.title,
        contentType: input.contentType,
        storageProvider: input.storageProvider ?? 'unconfigured',
        uploadedBy: this.ctx.userId,
      })
      .returning();
    return created as ClinicalDocumentRow;
  }

  /**
   * Sella el documento como almacenado con su hash y clave de storage. Se usará
   * cuando el pipeline de carga a object storage esté conectado.
   */
  async markStored(
    id: DocumentId,
    input: { contentHash: string; storageKey: string; storageProvider: string; sizeBytes?: number },
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(clinicalDocument)
      .set({
        status: 'stored',
        contentHash: input.contentHash,
        storageKey: input.storageKey,
        storageProvider: input.storageProvider,
        sizeBytes: input.sizeBytes ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(clinicalDocument.id, id),
          eq(clinicalDocument.tenantId, this.ctx.tenantId),
          isNull(clinicalDocument.deletedAt),
        ),
      )
      .returning({ id: clinicalDocument.id });
    return Boolean(updated);
  }

  async softDelete(id: DocumentId): Promise<boolean> {
    const [updated] = await this.db
      .update(clinicalDocument)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(clinicalDocument.id, id),
          eq(clinicalDocument.tenantId, this.ctx.tenantId),
          isNull(clinicalDocument.deletedAt),
        ),
      )
      .returning({ id: clinicalDocument.id });
    return Boolean(updated);
  }
}
