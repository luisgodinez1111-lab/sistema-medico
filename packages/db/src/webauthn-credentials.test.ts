import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newUserId } from '@medical-os/shared';
import type { Database } from './client';
import { createTestDatabase } from './testing';
import { appUser } from './schema';
import {
  listUserCredentials,
  countUserCredentials,
  saveCredential,
  deleteCredential,
  findCredentialByCredentialId,
  updateCredentialCounter,
  setRegistrationChallenge,
  consumeRegistrationChallenge,
} from './webauthn-credentials';

describe('webauthn-credentials (§NIVEL 2/15 passkeys)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
  });
  afterEach(async () => {
    await close();
  });

  async function makeUser() {
    const id = newUserId();
    await db.insert(appUser).values({
      id,
      email: `u${id}@x.local`,
      displayName: 'U',
      status: 'active',
    });
    return id;
  }

  const cred = {
    credentialId: 'Y3JlZC1pZC0x',
    publicKey: 'cHVia2V5',
    counter: 0,
    transports: 'internal,hybrid',
    deviceType: 'multiDevice',
    backedUp: true,
  } as const;

  it('guarda y lista passkeys por usuario', async () => {
    const user = await makeUser();
    const saved = await saveCredential(db, user, { ...cred, name: 'MacBook' });
    expect(saved.credentialId).toBe(cred.credentialId);
    expect(saved.userId).toBe(user);
    const list = await listUserCredentials(db, user);
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('MacBook');
    expect(await countUserCredentials(db, user)).toBe(1);
  });

  it('encuentra por credentialId (para el login) y bump del contador', async () => {
    const user = await makeUser();
    const saved = await saveCredential(db, user, cred);
    const found = await findCredentialByCredentialId(db, cred.credentialId);
    expect(found?.id).toBe(saved.id);
    await updateCredentialCounter(db, saved.id, 7);
    const after = await findCredentialByCredentialId(db, cred.credentialId);
    expect(after?.counter).toBe(7);
    expect(after?.lastUsedAt).not.toBeNull();
  });

  it('borra solo la passkey del propio usuario', async () => {
    const user = await makeUser();
    const other = await makeUser();
    const saved = await saveCredential(db, user, cred);
    // Otro usuario no puede borrarla.
    expect(await deleteCredential(db, other, saved.id)).toBe(false);
    expect(await deleteCredential(db, user, saved.id)).toBe(true);
    expect(await listUserCredentials(db, user)).toHaveLength(0);
  });

  it('challenge de enrolamiento: fijar, consumir una vez y quedar limpio', async () => {
    const user = await makeUser();
    await setRegistrationChallenge(db, user, 'chal-123');
    expect(await consumeRegistrationChallenge(db, user)).toBe('chal-123');
    // Segundo consumo ya no devuelve nada (un solo uso).
    expect(await consumeRegistrationChallenge(db, user)).toBeNull();
  });
});
