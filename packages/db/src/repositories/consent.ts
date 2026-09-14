import { and, eq, isNull, desc } from 'drizzle-orm';
import { newConsentId, type ConsentId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { consent, patient } from '../schema';

export type ConsentRow = (typeof consent)['$inferSelect'];
export type ConsentType = 'privacy-notice' | 'treatment' | 'data-sharing' | 'informed-procedure';

export interface GrantConsentInput {
  patientId: PatientId;
  type: ConsentType;
  policyVersion?: string;
  note?: string;
}

/**
 * Consentimientos del paciente (§NIVEL 3 governance, §26 LFPDPPP/NOM-024).
 * Tenant- y patient-scoped. Otorgar/revocar quedan atribuidos y fechados; revocar
 * NO borra (histórico verificable para cumplimiento).
 */
export class ConsentRepository {
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

  async listForPatient(patientId: PatientId): Promise<ConsentRow[]> {
    const rows = await this.db
      .select()
      .from(consent)
      .where(and(eq(consent.tenantId, this.ctx.tenantId), eq(consent.patientId, patientId)))
      .orderBy(desc(consent.grantedAt));
    return rows as ConsentRow[];
  }

  /** Otorga un consentimiento (queda `active`, atribuido al usuario). */
  async grant(input: GrantConsentInput): Promise<ConsentRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(consent)
      .values({
        id: newConsentId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        type: input.type,
        policyVersion: input.policyVersion ?? null,
        note: input.note ?? null,
        grantedBy: this.ctx.userId,
      })
      .returning();
    return created as ConsentRow;
  }

  /** Revoca un consentimiento activo (no borra: marca `revoked` + fecha/autor). */
  async revoke(id: ConsentId): Promise<boolean> {
    const [updated] = await this.db
      .update(consent)
      .set({ status: 'revoked', revokedAt: new Date(), revokedBy: this.ctx.userId })
      .where(
        and(
          eq(consent.id, id),
          eq(consent.tenantId, this.ctx.tenantId),
          eq(consent.status, 'active'),
        ),
      )
      .returning({ id: consent.id });
    return Boolean(updated);
  }
}
