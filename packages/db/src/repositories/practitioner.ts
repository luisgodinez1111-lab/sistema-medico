import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { practitioner, appUser } from '../schema';

export interface PrescriberInfo {
  displayName: string;
  licenseNumber: string | null;
  specialty: string | null;
}

/**
 * Datos del profesional (§NIVEL 2/3). Tenant-scoped. `getCurrent` devuelve el
 * prescriptor de la sesión (nombre + cédula + especialidad) para la receta
 * imprimible (§28 paso 8). Sólo lee la propia identidad dentro del tenant.
 */
export class PractitionerRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async getCurrent(): Promise<PrescriberInfo | null> {
    const [row] = await this.db
      .select({
        displayName: appUser.displayName,
        licenseNumber: practitioner.licenseNumber,
        specialty: practitioner.specialty,
      })
      .from(practitioner)
      .innerJoin(appUser, eq(appUser.id, practitioner.userId))
      .where(
        and(eq(practitioner.tenantId, this.ctx.tenantId), eq(practitioner.userId, this.ctx.userId)),
      )
      .limit(1);
    return (row as PrescriberInfo) ?? null;
  }
}
