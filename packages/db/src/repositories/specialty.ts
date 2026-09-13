import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { tenantSpecialty } from '../schema';
import { getSpecialtyPack } from '../specialty-packs';

/**
 * Especialidad clínica activa del tenant (R7). Tenant-scoped: siempre opera sobre
 * `ctx.tenantId`, nunca sobre otro tenant. Guarda sólo la referencia al pack del
 * catálogo versionado (no el contenido), para gobernanza (§33 #8).
 */
export class SpecialtyRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  /** Id del pack activo del tenant, o null si no ha elegido especialidad. */
  async getActivePackId(): Promise<string | null> {
    const [row] = await this.db
      .select({ packId: tenantSpecialty.packId })
      .from(tenantSpecialty)
      .where(eq(tenantSpecialty.tenantId, this.ctx.tenantId))
      .limit(1);
    return row?.packId ?? null;
  }

  /**
   * Fija (upsert) la especialidad del tenant. Rechaza packs desconocidos para no
   * guardar referencias inválidas. Devuelve false si el pack no existe.
   */
  async setActivePack(packId: string): Promise<boolean> {
    const pack = getSpecialtyPack(packId);
    if (!pack) return false;
    await this.db
      .insert(tenantSpecialty)
      .values({
        tenantId: this.ctx.tenantId,
        packId: pack.id,
        packVersion: pack.version,
        activatedBy: this.ctx.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tenantSpecialty.tenantId,
        set: {
          packId: pack.id,
          packVersion: pack.version,
          activatedBy: this.ctx.userId,
          updatedAt: new Date(),
        },
      });
    return true;
  }
}
