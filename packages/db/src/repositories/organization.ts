import { and, eq } from 'drizzle-orm';
import { newOrganizationId, type OrganizationId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { organization } from '../schema';

export interface OrganizationRow {
  id: OrganizationId;
  tenantId: string;
  name: string;
  createdAt: Date;
}

/**
 * Repositorio tenant-aware de organizaciones (§NIVEL 2).
 *
 * Defensa en profundidad (ADR-0002 §2): TODA consulta filtra por
 * `ctx.tenantId`. No se acepta un `tenantId` por parámetro — se deriva del
 * contexto de seguridad resuelto en el servidor. Las escrituras fuerzan el
 * `tenant_id` del contexto, de modo que es imposible crear datos en otro tenant.
 */
export class OrganizationRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async create(input: { name: string }): Promise<OrganizationRow> {
    const row = {
      id: newOrganizationId(),
      tenantId: this.ctx.tenantId,
      name: input.name,
    };
    const [created] = await this.db.insert(organization).values(row).returning();
    return created as OrganizationRow;
  }

  /** Devuelve la organización SOLO si pertenece al tenant del contexto. */
  async findById(id: OrganizationId): Promise<OrganizationRow | null> {
    const [row] = await this.db
      .select()
      .from(organization)
      .where(and(eq(organization.id, id), eq(organization.tenantId, this.ctx.tenantId)))
      .limit(1);
    return (row as OrganizationRow) ?? null;
  }

  async list(): Promise<OrganizationRow[]> {
    const rows = await this.db
      .select()
      .from(organization)
      .where(eq(organization.tenantId, this.ctx.tenantId));
    return rows as OrganizationRow[];
  }

  /** Renombra; afecta 0 filas si el recurso es de otro tenant (bloqueo IDOR). */
  async rename(id: OrganizationId, name: string): Promise<OrganizationRow | null> {
    const [updated] = await this.db
      .update(organization)
      .set({ name })
      .where(and(eq(organization.id, id), eq(organization.tenantId, this.ctx.tenantId)))
      .returning();
    return (updated as OrganizationRow) ?? null;
  }

  /** Borra; afecta 0 filas si el recurso es de otro tenant (bloqueo IDOR). */
  async delete(id: OrganizationId): Promise<boolean> {
    const deleted = await this.db
      .delete(organization)
      .where(and(eq(organization.id, id), eq(organization.tenantId, this.ctx.tenantId)))
      .returning();
    return deleted.length > 0;
  }
}
