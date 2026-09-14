'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  resolveRp,
  buildRegistrationOptions,
  verifyRegistration,
  listUserCredentials,
  saveCredential,
  deleteCredential,
  setRegistrationChallenge,
  consumeRegistrationChallenge,
  getUserMfaState,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
} from '@medical-os/db';
import type { UserId, WebAuthnCredentialId } from '@medical-os/shared';
import { getSessionUserId } from '@/server/context';
import { getDb } from '@/server/db';

/** Deriva el Relying Party del host real del request (funciona en cualquier alias). */
async function rpFromRequest() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  return resolveRp(host);
}

export interface RegistrationOptionsResult {
  ok: boolean;
  error?: string;
  options?: PublicKeyCredentialCreationOptionsJSON;
}

/**
 * Genera las opciones de registro de passkey para el usuario en sesión y guarda el
 * challenge (efímero). El cliente las pasa a `startRegistration` (§NIVEL 2/15).
 */
export async function getPasskeyRegistrationOptions(): Promise<RegistrationOptionsResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: 'Sin sesión válida.' };
  const db = getDb();
  const state = await getUserMfaState(db, userId as UserId);
  if (!state) return { ok: false, error: 'Usuario no válido.' };

  const existing = await listUserCredentials(db, userId as UserId);
  const options = await buildRegistrationOptions({
    rp: await rpFromRequest(),
    userId,
    userName: state.email,
    userDisplayName: state.email,
    existing: existing.map((c) => ({ credentialId: c.credentialId, transports: c.transports })),
  });
  await setRegistrationChallenge(db, userId as UserId, options.challenge);
  return { ok: true, options };
}

export interface SimpleResult {
  ok: boolean;
  error?: string;
}

/** Verifica la respuesta de registro y persiste la passkey. */
export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  name: string,
): Promise<SimpleResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: 'Sin sesión válida.' };
  const db = getDb();

  const expectedChallenge = await consumeRegistrationChallenge(db, userId as UserId);
  if (!expectedChallenge) return { ok: false, error: 'No hay enrolamiento en curso. Reintenta.' };

  let verified: Awaited<ReturnType<typeof verifyRegistration>>;
  try {
    verified = await verifyRegistration({
      rp: await rpFromRequest(),
      response,
      expectedChallenge,
    });
  } catch {
    return { ok: false, error: 'No se pudo verificar la passkey.' };
  }
  if (!verified) return { ok: false, error: 'La passkey no se pudo verificar.' };

  await saveCredential(db, userId as UserId, {
    credentialId: verified.credentialId,
    publicKey: verified.publicKey,
    counter: verified.counter,
    transports: verified.transports,
    deviceType: verified.deviceType,
    backedUp: verified.backedUp,
    name: name.trim() || 'Passkey',
  });
  revalidatePath('/security');
  return { ok: true };
}

/** Elimina una passkey del usuario. */
export async function deletePasskeyAction(id: string): Promise<SimpleResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: 'Sin sesión válida.' };
  const ok = await deleteCredential(getDb(), userId as UserId, id as WebAuthnCredentialId);
  if (!ok) return { ok: false, error: 'No se pudo eliminar.' };
  revalidatePath('/security');
  return { ok: true };
}
