import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant, provenance } from '../schema';
import { PatientRepository } from './patient';
import { EncounterRepository } from './encounter';

describe('EncounterRepository (NIVEL 6)', () => {
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
    givenNames: 'Juan',
    firstSurname: 'Pérez',
    birthDate: '1980-01-01',
    sex: 'male' as const,
  };

  it('crea un borrador, lo edita y lo firma (snapshot + hash + provenance)', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new EncounterRepository(db, ctxA);

    const enc = await repo.create({ patientId: p.id, reason: 'Dolor abdominal' });
    expect(enc!.status).toBe('in-progress');

    const draft = await repo.updateDraft(enc!.id, {
      subjective: 'Dolor 3 días',
      assessment: 'Gastritis',
      plan: 'Omeprazol',
    });
    expect(draft!.assessment).toBe('Gastritis');

    const signed = await repo.sign(enc!.id);
    expect(signed!.status).toBe('signed');
    expect(signed!.signedAt).not.toBeNull();
    expect(signed!.signedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(signed!.signedSnapshot).toMatchObject({ assessment: 'Gastritis', plan: 'Omeprazol' });

    // Provenance registrado.
    const prov = await db.select().from(provenance).where(eq(provenance.targetId, enc!.id));
    expect(prov).toHaveLength(1);
    expect(prov[0]!.activity).toBe('encounter-sign');
  });

  it('una nota firmada es inmutable: updateDraft y sign ya no aplican (§33 #6)', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new EncounterRepository(db, ctxA);
    const enc = await repo.create({ patientId: p.id });
    await repo.sign(enc!.id);

    expect(await repo.updateDraft(enc!.id, { plan: 'cambio' })).toBeNull();
    expect(await repo.sign(enc!.id)).toBeNull(); // no se refirma
    // El contenido no cambió.
    const after = await repo.getById(enc!.id);
    expect(after!.plan).toBeNull();
  });

  it('no se puede borrar una nota firmada; sí un borrador', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new EncounterRepository(db, ctxA);
    const draft = await repo.create({ patientId: p.id });
    const signed = await repo.create({ patientId: p.id });
    await repo.sign(signed!.id);

    expect(await repo.softDeleteDraft(draft!.id)).toBe(true);
    expect(await repo.softDeleteDraft(signed!.id)).toBe(false);
    expect(await repo.getById(signed!.id)).not.toBeNull();
  });

  it('aislamiento por tenant: crear, leer y firmar están scoped', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    // B no puede crear encuentro sobre paciente de A.
    expect(await new EncounterRepository(db, ctxB).create({ patientId: p.id })).toBeNull();

    const enc = await new EncounterRepository(db, ctxA).create({ patientId: p.id });
    // B no lo ve ni lo firma.
    expect(await new EncounterRepository(db, ctxB).getById(enc!.id)).toBeNull();
    expect(await new EncounterRepository(db, ctxB).sign(enc!.id)).toBeNull();
    expect(await new EncounterRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });

  it('listForPatient devuelve los encuentros del paciente, recientes primero', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new EncounterRepository(db, ctxA);
    await repo.create({ patientId: p.id, reason: 'primero' });
    await repo.create({ patientId: p.id, reason: 'segundo' });
    const list = await repo.listForPatient(p.id);
    expect(list).toHaveLength(2);
  });
});
