import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId, ConflictError } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository, buildDedupKey, normalizeName } from './patient';

describe('PatientRepository (NIVEL 3)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const tenantA = newTenantId();
    const tenantB = newTenantId();
    await db.insert(tenant).values([
      { id: tenantA, name: 'Clínica A', slug: 'a' },
      { id: tenantB, name: 'Clínica B', slug: 'b' },
    ]);
    ctxA = createTenantContext({ tenantId: tenantA, userId: newUserId() });
    ctxB = createTenantContext({ tenantId: tenantB, userId: newUserId() });
  });

  afterEach(async () => {
    await close();
  });

  const base = {
    givenNames: 'María Fernanda',
    firstSurname: 'Ruiz',
    secondSurname: 'Delgado',
    birthDate: '1991-04-12',
    sex: 'female' as const,
  };

  it('normaliza nombres sin acentos ni mayúsculas para dedup', () => {
    expect(normalizeName('María  FERNÁNDEZ ')).toBe('maria fernandez');
    expect(buildDedupKey(base)).toBe('maria fernanda ruiz delgado|1991-04-12');
  });

  it('crea un paciente forzando el tenant del contexto', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(p.tenantId).toBe(ctxA.tenantId);
    expect(p.mrn).toMatch(/^P-\d{6}$/);
    expect(p.dedupKey).toBe('maria fernanda ruiz delgado|1991-04-12');
    expect(p.deletedAt).toBeNull();
  });

  it('detecta duplicados por nombre+fecha dentro del tenant', async () => {
    const repoA = new PatientRepository(db, ctxA);
    await repoA.create(base);
    const dups = await repoA.findDuplicates(base);
    expect(dups).toHaveLength(1);
    expect(dups[0]!.reason).toBe('name_birthdate');
  });

  it('detecta duplicados por CURP como señal fuerte', async () => {
    const repoA = new PatientRepository(db, ctxA);
    await repoA.create({ ...base, curp: 'RUDM910412MDFXLR01' });
    const dups = await repoA.findDuplicates({
      givenNames: 'Otro',
      firstSurname: 'Nombre',
      birthDate: '2000-01-01',
      curp: 'RUDM910412MDFXLR01',
    });
    expect(dups).toHaveLength(1);
    expect(dups[0]!.reason).toBe('curp');
  });

  it('NO reporta como duplicado un paciente de otro tenant (aislamiento)', async () => {
    await new PatientRepository(db, ctxA).create(base);
    const dupsB = await new PatientRepository(db, ctxB).findDuplicates(base);
    expect(dupsB).toHaveLength(0);
  });

  it('rechaza MRN duplicado en el mismo tenant con ConflictError', async () => {
    const repoA = new PatientRepository(db, ctxA);
    await repoA.create({ ...base, mrn: 'EXP-001' });
    await expect(repoA.create({ ...base, mrn: 'EXP-001' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('permite el mismo MRN en tenants distintos', async () => {
    await new PatientRepository(db, ctxA).create({ ...base, mrn: 'EXP-001' });
    const pB = await new PatientRepository(db, ctxB).create({ ...base, mrn: 'EXP-001' });
    expect(pB.mrn).toBe('EXP-001');
  });

  it('findById no devuelve pacientes de otro tenant (IDOR)', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(await new PatientRepository(db, ctxB).findById(p.id)).toBeNull();
    expect(await new PatientRepository(db, ctxA).findById(p.id)).not.toBeNull();
  });

  it('softDelete es lógico: desaparece de lecturas normales pero persiste el registro', async () => {
    const repoA = new PatientRepository(db, ctxA);
    const p = await repoA.create(base);
    expect(await repoA.softDelete(p.id)).toBe(true);

    expect(await repoA.findById(p.id)).toBeNull();
    const withDeleted = await repoA.findById(p.id, { includeDeleted: true });
    expect(withDeleted).not.toBeNull();
    expect(withDeleted!.deletedAt).not.toBeNull();
    expect(withDeleted!.status).toBe('inactive');

    // Ya no cuenta como duplicado activo.
    expect(await repoA.findDuplicates(base)).toHaveLength(0);
    expect(await repoA.listRecent()).toHaveLength(0);
  });

  it('softDelete no puede borrar pacientes de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(await new PatientRepository(db, ctxB).softDelete(p.id)).toBe(false);
    expect(await new PatientRepository(db, ctxA).findById(p.id)).not.toBeNull();
  });

  it('search encuentra por apellido y por MRN, scoped al tenant', async () => {
    const repoA = new PatientRepository(db, ctxA);
    await repoA.create({ ...base, mrn: 'EXP-777' });
    expect(await repoA.search('ruiz')).toHaveLength(1);
    expect(await repoA.search('EXP-777')).toHaveLength(1);
    expect(await new PatientRepository(db, ctxB).search('ruiz')).toHaveLength(0);
  });
});
