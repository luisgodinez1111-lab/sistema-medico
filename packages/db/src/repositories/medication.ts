import { and, eq, isNull, desc } from 'drizzle-orm';
import {
  newMedicationRequestId,
  type MedicationRequestId,
  type EncounterId,
  type PatientId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { medicationRequest, allergy, patient } from '../schema';
import { checkPrescription, type SafetyAlert } from '../prescription-safety';

export type MedicationRequestRow = (typeof medicationRequest)['$inferSelect'];

export type MedicationRoute = 'oral' | 'iv' | 'im' | 'sc' | 'topical' | 'inhaled' | 'other';

export interface NewMedicationInput {
  patientId: PatientId;
  drug: string;
  dose?: string;
  route?: MedicationRoute;
  frequency?: string;
  durationDays?: string;
  instructions?: string;
  encounterId?: EncounterId;
}

/**
 * Repositorio tenant-aware de prescripciones (§NIVEL 8). Además del CRUD, expone
 * la evaluación de seguridad (alergias + duplicidad) para que la capa de
 * aplicación decida según severidad.
 */
export class MedicationRepository {
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

  async listActiveForPatient(patientId: PatientId): Promise<MedicationRequestRow[]> {
    const rows = await this.db
      .select()
      .from(medicationRequest)
      .where(
        and(
          eq(medicationRequest.tenantId, this.ctx.tenantId),
          eq(medicationRequest.patientId, patientId),
          eq(medicationRequest.status, 'active'),
          isNull(medicationRequest.deletedAt),
        ),
      )
      .orderBy(desc(medicationRequest.prescribedAt));
    return rows as MedicationRequestRow[];
  }

  /**
   * Evalúa la seguridad de prescribir `drug` a un paciente (alergias activas +
   * medicación activa). Scoped al tenant. Devuelve alertas estructuradas.
   */
  async checkSafety(patientId: PatientId, drug: string): Promise<SafetyAlert[]> {
    const allergies = await this.db
      .select({ substance: allergy.substance })
      .from(allergy)
      .where(
        and(
          eq(allergy.tenantId, this.ctx.tenantId),
          eq(allergy.patientId, patientId),
          isNull(allergy.deletedAt),
        ),
      );
    const activeMedications = (await this.listActiveForPatient(patientId)).map((m) => ({
      drug: m.drug,
    }));
    return checkPrescription({ drug, allergies, activeMedications });
  }

  /**
   * Crea la prescripción. Fuerza el tenant del contexto. Devuelve null si el
   * paciente no es del tenant. La decisión de seguridad (bloquear ante alerta
   * crítica) la toma la capa de aplicación vía `checkSafety`.
   */
  async prescribe(input: NewMedicationInput): Promise<MedicationRequestRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(medicationRequest)
      .values({
        id: newMedicationRequestId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        encounterId: input.encounterId ?? null,
        drug: input.drug,
        dose: input.dose ?? null,
        route: input.route ?? 'oral',
        frequency: input.frequency ?? null,
        durationDays: input.durationDays ?? null,
        instructions: input.instructions ?? null,
        prescribedBy: this.ctx.userId,
      })
      .returning();
    return created as MedicationRequestRow;
  }

  /** Suspende una prescripción activa. Devuelve false si no es del tenant. */
  async stop(id: MedicationRequestId): Promise<boolean> {
    const [updated] = await this.db
      .update(medicationRequest)
      .set({ status: 'stopped', updatedAt: new Date() })
      .where(
        and(
          eq(medicationRequest.id, id),
          eq(medicationRequest.tenantId, this.ctx.tenantId),
          eq(medicationRequest.status, 'active'),
        ),
      )
      .returning({ id: medicationRequest.id });
    return Boolean(updated);
  }
}
