import { and, eq, desc } from 'drizzle-orm';
import {
  newWebAuthnCredentialId,
  asId,
  type UserId,
  type WebAuthnCredentialId,
} from '@medical-os/shared';
import type { Database } from './client';
import { appUser, webauthnCredential } from './schema';

/**
 * Almacenamiento de passkeys WebAuthn (§NIVEL 2/15). Ligado a la identidad GLOBAL
 * (`app_user`), NO a un tenant. Guarda sólo material público (credentialId,
 * publicKey base64url, counter). El reto de enrolamiento vive en `app_user`
 * (efímero); el de login viaja en cookie (no hay usuario aún).
 */

export interface StoredCredential {
  id: WebAuthnCredentialId;
  userId: UserId;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface SaveCredentialInput {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  deviceType: string | null;
  backedUp: boolean;
  name?: string;
}

function toStored(row: typeof webauthnCredential.$inferSelect): StoredCredential {
  return {
    id: asId<WebAuthnCredentialId>(row.id),
    userId: asId<UserId>(row.userId),
    credentialId: row.credentialId,
    publicKey: row.publicKey,
    counter: row.counter,
    transports: row.transports,
    name: row.name,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

/** Passkeys del usuario (recientes primero). */
export async function listUserCredentials(
  db: Database,
  userId: UserId,
): Promise<StoredCredential[]> {
  const rows = await db
    .select()
    .from(webauthnCredential)
    .where(eq(webauthnCredential.userId, userId))
    .orderBy(desc(webauthnCredential.createdAt));
  return rows.map(toStored);
}

export async function countUserCredentials(db: Database, userId: UserId): Promise<number> {
  return (await listUserCredentials(db, userId)).length;
}

/** Persiste una nueva passkey verificada. */
export async function saveCredential(
  db: Database,
  userId: UserId,
  input: SaveCredentialInput,
): Promise<StoredCredential> {
  const [row] = await db
    .insert(webauthnCredential)
    .values({
      id: newWebAuthnCredentialId(),
      userId,
      credentialId: input.credentialId,
      publicKey: input.publicKey,
      counter: input.counter,
      transports: input.transports,
      deviceType: input.deviceType,
      backedUp: input.backedUp,
      name: input.name ?? null,
    })
    .returning();
  return toStored(row!);
}

/** Elimina una passkey del usuario (sólo suya). Devuelve true si borró algo. */
export async function deleteCredential(
  db: Database,
  userId: UserId,
  id: WebAuthnCredentialId,
): Promise<boolean> {
  const [deleted] = await db
    .delete(webauthnCredential)
    .where(and(eq(webauthnCredential.id, id), eq(webauthnCredential.userId, userId)))
    .returning({ id: webauthnCredential.id });
  return Boolean(deleted);
}

/** Busca una credencial por su credentialId (base64url), para el login. */
export async function findCredentialByCredentialId(
  db: Database,
  credentialId: string,
): Promise<StoredCredential | null> {
  const [row] = await db
    .select()
    .from(webauthnCredential)
    .where(eq(webauthnCredential.credentialId, credentialId))
    .limit(1);
  return row ? toStored(row) : null;
}

/** Actualiza el contador anti-clonación y marca el último uso. */
export async function updateCredentialCounter(
  db: Database,
  id: WebAuthnCredentialId,
  counter: number,
): Promise<void> {
  await db
    .update(webauthnCredential)
    .set({ counter, lastUsedAt: new Date() })
    .where(eq(webauthnCredential.id, id));
}

/** Fija el challenge de enrolamiento en curso (efímero) del usuario. */
export async function setRegistrationChallenge(
  db: Database,
  userId: UserId,
  challenge: string,
): Promise<void> {
  await db
    .update(appUser)
    .set({ currentWebauthnChallenge: challenge })
    .where(eq(appUser.id, userId));
}

/** Lee y limpia el challenge de enrolamiento (un solo uso). */
export async function consumeRegistrationChallenge(
  db: Database,
  userId: UserId,
): Promise<string | null> {
  const [u] = await db
    .select({ challenge: appUser.currentWebauthnChallenge })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  const challenge = u?.challenge ?? null;
  if (challenge) {
    await db.update(appUser).set({ currentWebauthnChallenge: null }).where(eq(appUser.id, userId));
  }
  return challenge;
}
