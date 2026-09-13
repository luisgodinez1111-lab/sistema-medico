import { and, eq, asc } from 'drizzle-orm';
import { newEncounterAddendumId, type EncounterId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { encounterAddendum, encounter, provenance } from '../schema';
import { newProvenanceId } from '@medical-os/shared';

export type EncounterAddendumRow = (typeof encounterAddendum)['$inferSelect'];

/**
 * Enmiendas/addenda de un encuentro (§NIVEL 6, §33 #6). APPEND-ONLY: se añaden,
 * nunca se editan ni borran. Sólo sobre encuentros FIRMADOS (una enmienda corrige
 * o aclara una nota ya cerrada; la nota original permanece inmutable).
 */
export class EncounterAddendumRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async listForEncounter(encounterId: EncounterId): Promise<EncounterAddendumRow[]> {
    const rows = await this.db
      .select()
      .from(encounterAddendum)
      .where(
        and(
          eq(encounterAddendum.tenantId, this.ctx.tenantId),
          eq(encounterAddendum.encounterId, encounterId),
        ),
      )
      .orderBy(asc(encounterAddendum.createdAt));
    return rows as EncounterAddendumRow[];
  }

  /**
   * Añade una enmienda a un encuentro FIRMADO del tenant/paciente. Registra
   * provenance ('encounter-amend'). Devuelve null si el encuentro no es del
   * tenant/paciente o no está firmado, o si el texto está vacío.
   */
  async add(
    encounterId: EncounterId,
    patientId: PatientId,
    text: string,
  ): Promise<EncounterAddendumRow | null> {
    const body = text.trim();
    if (!body) return null;

    const [enc] = await this.db
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
    if (!enc || enc.status !== 'signed') return null;

    const [created] = await this.db
      .insert(encounterAddendum)
      .values({
        id: newEncounterAddendumId(),
        tenantId: this.ctx.tenantId,
        patientId,
        encounterId,
        text: body,
        authorId: this.ctx.userId,
      })
      .returning();

    await this.db.insert(provenance).values({
      id: newProvenanceId(),
      tenantId: this.ctx.tenantId,
      targetType: 'encounter',
      targetId: encounterId,
      activity: 'encounter-amend',
      agentId: this.ctx.userId,
    });

    return created as EncounterAddendumRow;
  }
}
