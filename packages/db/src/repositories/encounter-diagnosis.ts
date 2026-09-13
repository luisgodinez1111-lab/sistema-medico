import { and, eq, inArray } from 'drizzle-orm';
import {
  newEncounterDiagnosisId,
  type EncounterId,
  type PatientId,
  type ConditionId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { encounterDiagnosis, encounter, condition } from '../schema';

export interface EncounterDiagnosisView {
  conditionId: ConditionId;
  code: string;
}

/**
 * Diagnósticos de un encuentro (§NIVEL 6, §28 paso 7). Liga Conditions ya
 * existentes del paciente al encuentro. Tenant-scoped; sólo sobre BORRADOR (la
 * nota firmada es inmutable, §33 #6). `setDiagnoses` reemplaza el conjunto.
 */
export class EncounterDiagnosisRepository {
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

  /** Diagnósticos del encuentro, con el texto del problema (join a condition). */
  async listForEncounter(encounterId: EncounterId): Promise<EncounterDiagnosisView[]> {
    const rows = await this.db
      .select({ conditionId: encounterDiagnosis.conditionId, code: condition.code })
      .from(encounterDiagnosis)
      .innerJoin(condition, eq(condition.id, encounterDiagnosis.conditionId))
      .where(
        and(
          eq(encounterDiagnosis.tenantId, this.ctx.tenantId),
          eq(encounterDiagnosis.encounterId, encounterId),
        ),
      );
    return rows as EncounterDiagnosisView[];
  }

  /**
   * Reemplaza el conjunto de diagnósticos del encuentro por `conditionIds`.
   * Valida que cada Condition pertenezca al tenant + paciente (no acepta ajenos).
   * Devuelve false si el encuentro no es borrador del tenant/paciente.
   */
  async setDiagnoses(
    encounterId: EncounterId,
    patientId: PatientId,
    conditionIds: ReadonlyArray<ConditionId>,
  ): Promise<boolean> {
    if (!(await this.draftEncounterInTenant(encounterId, patientId))) return false;

    // Sólo Conditions válidas de este paciente/tenant.
    const valid =
      conditionIds.length === 0
        ? []
        : await this.db
            .select({ id: condition.id })
            .from(condition)
            .where(
              and(
                eq(condition.tenantId, this.ctx.tenantId),
                eq(condition.patientId, patientId),
                inArray(condition.id, conditionIds as ConditionId[]),
              ),
            );
    const validIds = new Set(valid.map((v) => v.id));

    // Reemplazo: borra los actuales y reinserta los válidos (relación, no PHI).
    await this.db
      .delete(encounterDiagnosis)
      .where(
        and(
          eq(encounterDiagnosis.tenantId, this.ctx.tenantId),
          eq(encounterDiagnosis.encounterId, encounterId),
        ),
      );
    for (const cid of validIds) {
      await this.db.insert(encounterDiagnosis).values({
        id: newEncounterDiagnosisId(),
        tenantId: this.ctx.tenantId,
        patientId,
        encounterId,
        conditionId: cid as ConditionId,
      });
    }
    return true;
  }
}
