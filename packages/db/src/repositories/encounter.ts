import { createHash } from 'node:crypto';
import { and, eq, isNull, desc } from 'drizzle-orm';
import {
  newEncounterId,
  newProvenanceId,
  type EncounterId,
  type PatientId,
  type PractitionerId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { encounter, provenance, patient } from '../schema';

export type EncounterRow = (typeof encounter)['$inferSelect'];

export type EncounterType = 'medicina-general' | 'seguimiento' | 'urgencia' | 'teleconsulta';

export interface NewEncounterInput {
  patientId: PatientId;
  type?: EncounterType;
  reason?: string;
  practitionerId?: PractitionerId;
}

export interface EncounterDraftInput {
  reason?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

/**
 * Repositorio tenant-aware de encuentros clínicos (§NIVEL 6).
 * - Borrador editable sólo mientras `status = in-progress`.
 * - Al FIRMAR se congela: snapshot + hash de integridad + provenance; una nota
 *   firmada nunca se edita destructivamente (§33 #6).
 */
export class EncounterRepository {
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

  async getById(id: EncounterId): Promise<EncounterRow | null> {
    const [row] = await this.db
      .select()
      .from(encounter)
      .where(
        and(
          eq(encounter.id, id),
          eq(encounter.tenantId, this.ctx.tenantId),
          isNull(encounter.deletedAt),
        ),
      )
      .limit(1);
    return (row as EncounterRow) ?? null;
  }

  /** Encuentros del paciente, más recientes primero (para el timeline). */
  async listForPatient(patientId: PatientId): Promise<EncounterRow[]> {
    const rows = await this.db
      .select()
      .from(encounter)
      .where(
        and(
          eq(encounter.tenantId, this.ctx.tenantId),
          eq(encounter.patientId, patientId),
          isNull(encounter.deletedAt),
        ),
      )
      .orderBy(desc(encounter.startedAt));
    return rows as EncounterRow[];
  }

  async create(input: NewEncounterInput): Promise<EncounterRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(encounter)
      .values({
        id: newEncounterId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        type: input.type ?? 'medicina-general',
        reason: input.reason ?? null,
        practitionerId: input.practitionerId ?? null,
      })
      .returning();
    return created as EncounterRow;
  }

  /**
   * Actualiza el borrador. Devuelve null si no existe, no es del tenant o ya
   * está firmado (inmutable, §33 #6).
   */
  async updateDraft(id: EncounterId, input: EncounterDraftInput): Promise<EncounterRow | null> {
    const current = await this.getById(id);
    if (!current || current.status !== 'in-progress') return null;

    const [updated] = await this.db
      .update(encounter)
      .set({
        reason: input.reason ?? current.reason,
        subjective: input.subjective ?? current.subjective,
        objective: input.objective ?? current.objective,
        assessment: input.assessment ?? current.assessment,
        plan: input.plan ?? current.plan,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(encounter.id, id),
          eq(encounter.tenantId, this.ctx.tenantId),
          eq(encounter.status, 'in-progress'),
        ),
      )
      .returning();
    return (updated as EncounterRow) ?? null;
  }

  /**
   * Firma el encuentro: congela snapshot + hash y registra provenance. Sólo
   * procede sobre un borrador. Devuelve null si no aplica.
   */
  async sign(id: EncounterId): Promise<EncounterRow | null> {
    const current = await this.getById(id);
    if (!current || current.status !== 'in-progress') return null;

    const signedAt = new Date();
    const snapshot: Record<string, unknown> = {
      encounterId: current.id,
      patientId: current.patientId,
      type: current.type,
      reason: current.reason,
      subjective: current.subjective,
      objective: current.objective,
      assessment: current.assessment,
      plan: current.plan,
      startedAt: current.startedAt,
      signedBy: this.ctx.userId,
      signedAt: signedAt.toISOString(),
    };
    // Hash de integridad sobre una serialización canónica del contenido firmado.
    const signedHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

    const [signed] = await this.db
      .update(encounter)
      .set({
        status: 'signed',
        signedAt,
        signedBy: this.ctx.userId,
        signedHash,
        signedSnapshot: snapshot,
        updatedAt: signedAt,
      })
      .where(
        and(
          eq(encounter.id, id),
          eq(encounter.tenantId, this.ctx.tenantId),
          eq(encounter.status, 'in-progress'),
        ),
      )
      .returning();
    if (!signed) return null;

    // Provenance del dato clínico (origen, autor, tiempo) — §NIVEL 3, ADR-0003 §5.
    await this.db.insert(provenance).values({
      id: newProvenanceId(),
      tenantId: this.ctx.tenantId,
      targetType: 'encounter',
      targetId: id,
      activity: 'encounter-sign',
      agentId: this.ctx.userId,
    });

    return signed as EncounterRow;
  }

  /** Baja lógica sólo de borradores (no se borran notas firmadas, §33 #6). */
  async softDeleteDraft(id: EncounterId): Promise<boolean> {
    const [updated] = await this.db
      .update(encounter)
      .set({ deletedAt: new Date(), status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(encounter.id, id),
          eq(encounter.tenantId, this.ctx.tenantId),
          eq(encounter.status, 'in-progress'),
          isNull(encounter.deletedAt),
        ),
      )
      .returning({ id: encounter.id });
    return Boolean(updated);
  }
}
