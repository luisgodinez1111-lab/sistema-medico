import 'server-only';
import {
  resolveTenantContext,
  resolveTenantContextForUser,
  type TenantContext,
} from '@medical-os/db';
import { auth } from '@/auth';
import { getDb } from './db';

/**
 * Resuelve el contexto de seguridad de la petición actual (§NIVEL 2).
 *
 * Vía real: lee el principal autenticado desde la sesión Auth.js (JWT verificado
 * en servidor) y carga tenant + permisos a partir del `uid` — NUNCA desde input
 * del cliente (ADR-0002).
 *
 * Fallback demo (solo si `AUTH_DEMO_FALLBACK=1`): identidad tomada de entorno del
 * servidor, para desarrollo local y pruebas sin IdP. En producción NO se activa,
 * así que sin sesión el contexto es null (rutas protegidas por el middleware).
 */
export async function getRequestContext(): Promise<TenantContext | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (userId) {
    return resolveTenantContextForUser(getDb(), { userId });
  }

  if (process.env.AUTH_DEMO_FALLBACK === '1') {
    const tenantSlug = process.env.DEMO_TENANT_SLUG ?? 'velum-demo';
    const userEmail = process.env.DEMO_USER_EMAIL ?? 'demo@velum.local';
    return resolveTenantContext(getDb(), { tenantSlug, userEmail });
  }

  return null;
}
