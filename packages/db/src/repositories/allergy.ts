import { and, eq, isNull, desc } from 'drizzle-orm';
import { newAllergyId, type AllergyId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { allergy, patient } from '../schema';

export type AllergyRow = (typeof allergy)['$inferSelect'];

export interface NewAllergyInput {
  patientId: PatientId;
  substance: string;
  category?: 'medication' | 'food' | 'environment' | 'biologic' | 'other';
  criticality?: 'low' | 'high' | 'unable-to-assess';
  reaction?: string;
  note?: string;
}

/**
 * Repositorio tenant-aware de alergias (§NIVEL 3, ADR-0002/0003).
 *
 * - Scoping obligatorio por `ctx.tenantId` en toda operación.
 * - Toda escritura valida que el paciente pertenezca al tenant (evita adjuntar
 *   alergias a pacientes de otro tenant).
 * - Registrar/marcar-revisado sella `allergies_reviewed_at` en el paciente, para
 *   distinguir "sin alergias conocidas" de "no evaluado" (§27).
 */
export class AllergyRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  /** Verifica que el paciente exista y sea del tenant del contexto. */
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

  /** Alergias activas del paciente, más críticas primero. */
  async listForPatient(patientId: PatientId): Promise<AllergyRow[]> {
    const rows = await this.db
      .select()
      .from(allergy)
      .where(
        and(
          eq(allergy.tenantId, this.ctx.tenantId),
          eq(allergy.patientId, patientId),
          isNull(allergy.deletedAt),
        ),
      )
      .orderBy(desc(allergy.criticality), desc(allergy.recordedAt));
    return rows as AllergyRow[];
  }

  /**
   * Registra una alergia. Devuelve null si el paciente no es del tenant.
   * Sella además la revisión de alergias del paciente.
   */
  async create(input: NewAllergyInput): Promise<AllergyRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;

    const [created] = await this.db
      .insert(allergy)
      .values({
        id: newAllergyId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        substance: input.substance,
        category: input.category ?? 'medication',
        criticality: input.criticality ?? 'unable-to-assess',
        reaction: input.reaction ?? null,
        note: input.note ?? null,
        recordedBy: this.ctx.userId,
      })
      .returning();

    await this.markReviewed(input.patientId);
    return created as AllergyRow;
  }

  /**
   * Marca el estado de alergias como revisado (NKDA explícito si no hay filas).
   * Devuelve false si el paciente no es del tenant.
   */
  async markReviewed(patientId: PatientId): Promise<boolean> {
    const [updated] = await this.db
      .update(patient)
      .set({ allergiesReviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(patient.id, patientId), eq(patient.tenantId, this.ctx.tenantId)))
      .returning({ id: patient.id });
    return Boolean(updated);
  }

  /** Baja lógica de una alergia. Devuelve false si no es del tenant. */
  async softDelete(id: AllergyId): Promise<boolean> {
    const [updated] = await this.db
      .update(allergy)
      .set({ deletedAt: new Date(), clinicalStatus: 'inactive', updatedAt: new Date() })
      .where(
        and(eq(allergy.id, id), eq(allergy.tenantId, this.ctx.tenantId), isNull(allergy.deletedAt)),
      )
      .returning({ id: allergy.id });
    return Boolean(updated);
  }
}
