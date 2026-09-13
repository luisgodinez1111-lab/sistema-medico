import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newUserId } from '@medical-os/shared';
import type { Database } from './client';
import { createTestDatabase } from './testing';
import { appUser } from './schema';
import { hashPassword, verifyPassword, authenticateUser } from './auth-credentials';

describe('auth-credentials (NIVEL 2)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
  });
  afterEach(async () => {
    await close();
  });

  it('hashPassword produce un hash verificable y distinto de la contraseña', async () => {
    const hash = await hashPassword('S3cret-pass');
    expect(hash).not.toBe('S3cret-pass');
    expect(await verifyPassword('S3cret-pass', hash)).toBe(true);
    expect(await verifyPassword('otra', hash)).toBe(false);
  });

  it('authenticateUser acepta credenciales válidas de un usuario activo', async () => {
    const hash = await hashPassword('correcta');
    await db.insert(appUser).values({
      id: newUserId(),
      email: 'ana@clinica.mx',
      displayName: 'Ana',
      status: 'active',
      passwordHash: hash,
    });
    const user = await authenticateUser(db, 'ana@clinica.mx', 'correcta');
    expect(user?.email).toBe('ana@clinica.mx');
    expect(user?.displayName).toBe('Ana');
  });

  it('normaliza el email (mayúsculas/espacios)', async () => {
    await db.insert(appUser).values({
      id: newUserId(),
      email: 'ana@clinica.mx',
      displayName: 'Ana',
      status: 'active',
      passwordHash: await hashPassword('correcta'),
    });
    expect(await authenticateUser(db, '  ANA@Clinica.MX ', 'correcta')).not.toBeNull();
  });

  it('rechaza contraseña incorrecta, usuario inactivo, sin hash o inexistente', async () => {
    const base = { displayName: 'X', passwordHash: await hashPassword('correcta') } as const;
    await db.insert(appUser).values([
      { id: newUserId(), email: 'activa@x.mx', status: 'active', ...base },
      { id: newUserId(), email: 'inactiva@x.mx', status: 'suspended', ...base },
      {
        id: newUserId(),
        email: 'sinhash@x.mx',
        status: 'active',
        displayName: 'X',
        passwordHash: null,
      },
    ]);
    expect(await authenticateUser(db, 'activa@x.mx', 'mala')).toBeNull();
    expect(await authenticateUser(db, 'inactiva@x.mx', 'correcta')).toBeNull();
    expect(await authenticateUser(db, 'sinhash@x.mx', 'correcta')).toBeNull();
    expect(await authenticateUser(db, 'noexiste@x.mx', 'correcta')).toBeNull();
    expect(await authenticateUser(db, '', '')).toBeNull();
  });
});
