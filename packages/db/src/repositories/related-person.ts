import { and, eq, isNull, desc } from 'drizzle-orm';
import { newRelatedPersonId, type RelatedPersonId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { relatedPerson, patient } from '../schema';

export type RelatedPersonRow = (typeof relatedPerson)['$inferSelect'];

export type RelationshipType =
  | 'mother'
  | 'father'
  | 'guardian'
  | 'spouse'
  | 'sibling'
  | 'child'
  | 'caregiver'
  | 'emergency-contact'
  | 'other';

export interface NewRelatedPersonInput {
  patientId: PatientId;
  name: string;
  relationship?: RelationshipType;
  phone?: string;
  email?: string;
  isEmergencyContact?: boolean;
  note?: string;
}

/**
 * Repositorio tenant-aware de personas relacionadas (§NIVEL 3).
 * Mismo contrato de scoping y validación patient-in-tenant que los demás.
 */
export class RelatedPersonRepository {
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

  /** Contactos del paciente; contactos de emergencia primero. */
  async listForPatient(patientId: PatientId): Promise<RelatedPersonRow[]> {
    const rows = await this.db
      .select()
      .from(relatedPerson)
      .where(
        and(
          eq(relatedPerson.tenantId, this.ctx.tenantId),
          eq(relatedPerson.patientId, patientId),
          isNull(relatedPerson.deletedAt),
        ),
      )
      .orderBy(desc(relatedPerson.isEmergencyContact), desc(relatedPerson.recordedAt));
    return rows as RelatedPersonRow[];
  }

  /** Registra un contacto. Devuelve null si el paciente no es del tenant. */
  async create(input: NewRelatedPersonInput): Promise<RelatedPersonRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(relatedPerson)
      .values({
        id: newRelatedPersonId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        name: input.name,
        relationship: input.relationship ?? 'other',
        phone: input.phone ?? null,
        email: input.email ?? null,
        isEmergencyContact: input.isEmergencyContact ?? false,
        note: input.note ?? null,
        recordedBy: this.ctx.userId,
      })
      .returning();
    return created as RelatedPersonRow;
  }

  /** Baja lógica. Devuelve false si no es del tenant. */
  async softDelete(id: RelatedPersonId): Promise<boolean> {
    const [updated] = await this.db
      .update(relatedPerson)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(relatedPerson.id, id),
          eq(relatedPerson.tenantId, this.ctx.tenantId),
          isNull(relatedPerson.deletedAt),
        ),
      )
      .returning({ id: relatedPerson.id });
    return Boolean(updated);
  }
}
