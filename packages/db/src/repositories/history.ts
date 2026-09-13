import { and, eq, isNull } from 'drizzle-orm';
import { newHistoryEntryId, type HistoryEntryId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { historyEntry, patient } from '../schema';
import { HISTORY_SCHEMA_VERSION } from '../clinical-history';

export type HistoryEntryRow = (typeof historyEntry)['$inferSelect'];

export interface SetHistoryEntryInput {
  patientId: PatientId;
  section: string;
  code: string;
  value: string;
  note?: string;
}

/**
 * Repositorio tenant-aware de la historia clínica estructurada (§NIVEL 5).
 * Cada ítem (section+code) es único por paciente → `setEntry` hace upsert.
 */
export class HistoryRepository {
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

  /** Entradas activas del paciente (todas las secciones). */
  async listForPatient(patientId: PatientId): Promise<HistoryEntryRow[]> {
    const rows = await this.db
      .select()
      .from(historyEntry)
      .where(
        and(
          eq(historyEntry.tenantId, this.ctx.tenantId),
          eq(historyEntry.patientId, patientId),
          isNull(historyEntry.deletedAt),
        ),
      );
    return rows as HistoryEntryRow[];
  }

  /**
   * Crea o actualiza un ítem de historia (upsert por section+code). Un valor
   * vacío borra (baja lógica) el ítem existente. Devuelve null si el paciente no
   * es del tenant.
   */
  async setEntry(input: SetHistoryEntryInput): Promise<HistoryEntryRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;

    const [existing] = await this.db
      .select()
      .from(historyEntry)
      .where(
        and(
          eq(historyEntry.tenantId, this.ctx.tenantId),
          eq(historyEntry.patientId, input.patientId),
          eq(historyEntry.section, input.section),
          eq(historyEntry.code, input.code),
          isNull(historyEntry.deletedAt),
        ),
      )
      .limit(1);

    const value = input.value.trim();

    if (value === '') {
      if (existing) {
        await this.db
          .update(historyEntry)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(historyEntry.id, existing.id));
      }
      return null;
    }

    if (existing) {
      const [updated] = await this.db
        .update(historyEntry)
        .set({ value, note: input.note ?? null, updatedAt: new Date() })
        .where(eq(historyEntry.id, existing.id))
        .returning();
      return updated as HistoryEntryRow;
    }

    const [created] = await this.db
      .insert(historyEntry)
      .values({
        id: newHistoryEntryId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        section: input.section,
        code: input.code,
        value,
        note: input.note ?? null,
        schemaVersion: HISTORY_SCHEMA_VERSION,
        recordedBy: this.ctx.userId,
      })
      .returning();
    return created as HistoryEntryRow;
  }

  async softDelete(id: HistoryEntryId): Promise<boolean> {
    const [updated] = await this.db
      .update(historyEntry)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(historyEntry.id, id),
          eq(historyEntry.tenantId, this.ctx.tenantId),
          isNull(historyEntry.deletedAt),
        ),
      )
      .returning({ id: historyEntry.id });
    return Boolean(updated);
  }
}
