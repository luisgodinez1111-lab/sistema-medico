import { and, eq } from 'drizzle-orm';
import { newFacilityId, type FacilityId, type OrganizationId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { facility } from '../schema';

export interface FacilityRow {
  id: FacilityId;
  tenantId: string;
  organizationId: OrganizationId;
  name: string;
  timezone: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}

/**
 * Repositorio tenant-aware de consultorios/sedes (§NIVEL 2, §NIVEL 11).
 * Mismo contrato de scoping que OrganizationRepository (ADR-0002 §2).
 */
export class FacilityRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async create(input: {
    organizationId: OrganizationId;
    name: string;
    timezone?: string;
  }): Promise<FacilityRow> {
    const row = {
      id: newFacilityId(),
      tenantId: this.ctx.tenantId,
      organizationId: input.organizationId,
      name: input.name,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    };
    const [created] = await this.db.insert(facility).values(row).returning();
    return created as FacilityRow;
  }

  async findById(id: FacilityId): Promise<FacilityRow | null> {
    const [row] = await this.db
      .select()
      .from(facility)
      .where(and(eq(facility.id, id), eq(facility.tenantId, this.ctx.tenantId)))
      .limit(1);
    return (row as FacilityRow) ?? null;
  }

  async listByOrganization(organizationId: OrganizationId): Promise<FacilityRow[]> {
    const rows = await this.db
      .select()
      .from(facility)
      .where(
        and(eq(facility.tenantId, this.ctx.tenantId), eq(facility.organizationId, organizationId)),
      );
    return rows as FacilityRow[];
  }
}
