import 'server-only';
import { resolveTenantContext, type TenantContext } from '@medical-os/db';
import { getDb } from './db';

/**
 * Resuelve el contexto de seguridad de la petición actual (§NIVEL 2).
 *
 * PROVISIONAL: mientras no exista el IdP (NIVEL 2 auth), la identidad se toma de
 * variables de entorno del servidor, NUNCA del cliente. Cuando exista la sesión
 * real, aquí se leerá el principal autenticado (cookie/JWT verificado en server)
 * y se eliminará el fallback a entorno. El resto de la app ya depende de este
 * punto único, así que el cambio quedará aislado.
 */
export async function getRequestContext(): Promise<TenantContext | null> {
  const tenantSlug = process.env.DEMO_TENANT_SLUG ?? 'velum-demo';
  const userEmail = process.env.DEMO_USER_EMAIL ?? 'demo@velum.local';
  return resolveTenantContext(getDb(), { tenantSlug, userEmail });
}
