import { and, eq } from 'drizzle-orm';
import { newExamFindingId, type EncounterId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { encounterExamFinding, encounter } from '../schema';

export type ExamFindingRow = (typeof encounterExamFinding)['$inferSelect'];

export interface SetExamFindingInput {
  encounterId: EncounterId;
  patientId: PatientId;
  section: string;
  normal: boolean;
  note?: string;
}

/**
 * Exploración física estructurada por encuentro (§NIVEL 6, §28 paso 6).
 * Tenant-scoped. Sólo permite escribir sobre encuentros en BORRADOR (la nota
 * firmada es inmutable, §33 #6). Upsert idempotente por (encuentro, sección).
 */
export class ExamRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  private async draftEncounterInTenant(
    encounterId: EncounterId,
    patientId: PatientId,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ status: encounter.status })
      .from(encounter)
      .where(
        and(
          eq(encounter.id, encounterId),
          eq(encounter.tenantId, this.ctx.tenantId),
          eq(encounter.patientId, patientId),
        ),
      )
      .limit(1);
    return row?.status === 'in-progress';
  }

  async listForEncounter(encounterId: EncounterId): Promise<ExamFindingRow[]> {
    const rows = await this.db
      .select()
      .from(encounterExamFinding)
      .where(
        and(
          eq(encounterExamFinding.tenantId, this.ctx.tenantId),
          eq(encounterExamFinding.encounterId, encounterId),
        ),
      );
    return rows as ExamFindingRow[];
  }

  /**
   * Registra/actualiza un hallazgo de una sección. Devuelve false si el encuentro
   * no es del tenant/paciente o ya no es borrador. Upsert por (encuentro, sección).
   */
  async setFinding(input: SetExamFindingInput): Promise<boolean> {
    if (!(await this.draftEncounterInTenant(input.encounterId, input.patientId))) return false;
    await this.db
      .insert(encounterExamFinding)
      .values({
        id: newExamFindingId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        section: input.section,
        normal: input.normal,
        note: input.note ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          encounterExamFinding.tenantId,
          encounterExamFinding.encounterId,
          encounterExamFinding.section,
        ],
        set: { normal: input.normal, note: input.note ?? null, updatedAt: new Date() },
      });
    return true;
  }
}
