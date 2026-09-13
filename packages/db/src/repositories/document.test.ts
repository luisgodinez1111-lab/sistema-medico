import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { DocumentRepository } from './document';

describe('DocumentRepository (R5)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const tenantA = newTenantId();
    const tenantB = newTenantId();
    await db.insert(tenant).values([
      { id: tenantA, name: 'A', slug: 'a' },
      { id: tenantB, name: 'B', slug: 'b' },
    ]);
    ctxA = createTenantContext({ tenantId: tenantA, userId: newUserId() });
    ctxB = createTenantContext({ tenantId: tenantB, userId: newUserId() });
  });

  afterEach(async () => {
    await close();
  });

  const base = {
    givenNames: 'Ana',
    firstSurname: 'Soto',
    birthDate: '1985-06-06',
    sex: 'female' as const,
  };

  it('registra metadata (pending-upload, sin bytes ni hash) y la lista', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new DocumentRepository(db, ctxA);
    const doc = await repo.register({
      patientId: p.id,
      title: 'Radiografía de tórax',
      contentType: 'application/pdf',
    });
    expect(doc!.status).toBe('pending-upload');
    expect(doc!.contentHash).toBeNull();
    expect(doc!.storageKey).toBeNull();
    expect(doc!.storageProvider).toBe('unconfigured');
    expect(await repo.listForPatient(p.id)).toHaveLength(1);
  });

  it('markStored sella hash + clave + provider', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new DocumentRepository(db, ctxA);
    const doc = await repo.register({
      patientId: p.id,
      title: 'Nota',
      contentType: 'application/pdf',
    });
    expect(
      await repo.markStored(doc!.id, {
        contentHash: 'a'.repeat(64),
        storageKey: 'tenantA/doc1.pdf',
        storageProvider: 'blob',
        sizeBytes: 1024,
      }),
    ).toBe(true);
    const stored = (await repo.listForPatient(p.id))[0]!;
    expect(stored.status).toBe('stored');
    expect(stored.contentHash).toHaveLength(64);
    expect(stored.storageProvider).toBe('blob');
  });

  it('no registra documentos en paciente de otro tenant; lista aislada', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(
      await new DocumentRepository(db, ctxB).register({
        patientId: p.id,
        title: 'x',
        contentType: 'application/pdf',
      }),
    ).toBeNull();
    await new DocumentRepository(db, ctxA).register({
      patientId: p.id,
      title: 'Doc A',
      contentType: 'application/pdf',
    });
    expect(await new DocumentRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
    expect(await new DocumentRepository(db, ctxA).listForPatient(p.id)).toHaveLength(1);
  });
});
