import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { asId, type UserId } from '@medical-os/shared';
import type { Database } from './client';
import { appUser } from './schema';

/**
 * Credenciales de acceso (NIVEL 2, IdP con Auth.js Credentials + JWT).
 *
 * - La contraseña NUNCA se guarda en claro: se almacena su hash bcrypt en
 *   `app_user.password_hash` (§NIVEL 2, §33).
 * - `authenticateUser` es la única puerta de verificación: valida hash y estado
 *   activo del usuario. NO resuelve tenant/permiso (eso lo hace el resolver de
 *   contexto tras autenticar).
 * - No se filtra si el fallo fue por email inexistente o contraseña incorrecta
 *   (mismo resultado null) para no dar señales a un atacante.
 */

const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AuthenticatedUser {
  id: UserId;
  email: string;
  displayName: string;
}

/**
 * Verifica email + contraseña contra `app_user`. Devuelve el usuario mínimo si
 * las credenciales son válidas y el usuario está activo; null en cualquier otro
 * caso (email inexistente, sin hash, inactivo o contraseña incorrecta).
 */
export async function authenticateUser(
  db: Database,
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const [u] = await db
    .select({
      id: appUser.id,
      email: appUser.email,
      displayName: appUser.displayName,
      passwordHash: appUser.passwordHash,
      status: appUser.status,
    })
    .from(appUser)
    .where(eq(appUser.email, normalizedEmail))
    .limit(1);

  if (!u || u.status !== 'active' || !u.passwordHash) return null;
  const valid = await verifyPassword(password, u.passwordHash);
  if (!valid) return null;

  return { id: asId<UserId>(u.id), email: u.email, displayName: u.displayName };
}
