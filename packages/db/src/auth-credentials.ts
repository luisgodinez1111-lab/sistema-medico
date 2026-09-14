import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { asId, type UserId } from '@medical-os/shared';
import type { Database } from './client';
import { appUser } from './schema';
import { verifyTotp } from './totp';

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
  /** Si el usuario tiene MFA (TOTP) activo: el login exige un segundo factor. */
  mfaEnabled: boolean;
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
      mfaEnabled: appUser.mfaEnabled,
    })
    .from(appUser)
    .where(eq(appUser.email, normalizedEmail))
    .limit(1);

  if (!u || u.status !== 'active' || !u.passwordHash) return null;
  const valid = await verifyPassword(password, u.passwordHash);
  if (!valid) return null;

  return {
    id: asId<UserId>(u.id),
    email: u.email,
    displayName: u.displayName,
    mfaEnabled: u.mfaEnabled,
  };
}

/**
 * Carga la identidad mínima de un usuario ACTIVO por id (para el login con passkey,
 * donde el usuario se identifica por la credencial, no por email+contraseña).
 */
export async function getActiveUserById(
  db: Database,
  userId: UserId,
): Promise<AuthenticatedUser | null> {
  const [u] = await db
    .select({
      id: appUser.id,
      email: appUser.email,
      displayName: appUser.displayName,
      status: appUser.status,
      mfaEnabled: appUser.mfaEnabled,
    })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  if (!u || u.status !== 'active') return null;
  return {
    id: asId<UserId>(u.id),
    email: u.email,
    displayName: u.displayName,
    mfaEnabled: u.mfaEnabled,
  };
}

/**
 * Verifica el segundo factor (TOTP) de un usuario por email. Devuelve true sólo si
 * el usuario tiene MFA activo, un secreto guardado y el token es válido.
 */
export async function verifyUserTotp(db: Database, email: string, token: string): Promise<boolean> {
  const [u] = await db
    .select({ enabled: appUser.mfaEnabled, secret: appUser.mfaSecret })
    .from(appUser)
    .where(eq(appUser.email, email.trim().toLowerCase()))
    .limit(1);
  if (!u || !u.enabled || !u.secret) return false;
  return verifyTotp(u.secret, token);
}

/** Guarda el secreto TOTP (enrolamiento en curso; aún no activa MFA). */
export async function setUserMfaSecret(
  db: Database,
  userId: UserId,
  secret: string,
): Promise<void> {
  await db.update(appUser).set({ mfaSecret: secret }).where(eq(appUser.id, userId));
}

/**
 * Activa MFA si el token confirma que el usuario configuró bien su app. Requiere
 * un secreto previamente guardado. Devuelve false si el token no valida.
 */
export async function enableUserMfa(db: Database, userId: UserId, token: string): Promise<boolean> {
  const [u] = await db
    .select({ secret: appUser.mfaSecret })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  if (!u?.secret || !verifyTotp(u.secret, token)) return false;
  await db.update(appUser).set({ mfaEnabled: true }).where(eq(appUser.id, userId));
  return true;
}

/** Desactiva MFA y borra el secreto. */
export async function disableUserMfa(db: Database, userId: UserId): Promise<void> {
  await db
    .update(appUser)
    .set({ mfaEnabled: false, mfaSecret: null })
    .where(eq(appUser.id, userId));
}

export interface UserMfaState {
  email: string;
  enabled: boolean;
  hasSecret: boolean;
  secret: string | null;
}

/** Estado MFA del usuario actual (para la pantalla de seguridad/enrolamiento). */
export async function getUserMfaState(db: Database, userId: UserId): Promise<UserMfaState | null> {
  const [u] = await db
    .select({ email: appUser.email, enabled: appUser.mfaEnabled, secret: appUser.mfaSecret })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  if (!u) return null;
  return { email: u.email, enabled: u.enabled, hasSecret: Boolean(u.secret), secret: u.secret };
}
