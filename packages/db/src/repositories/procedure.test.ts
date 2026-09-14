import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ProcedureRepository } from './procedure';

describe('ProcedureRepository (§NIVEL 3, FHIR Procedure)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctx: TenantContext;
  let ctxOther: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const t = newTenantId();
    const o = newTenantId();
    await db.insert(tenant).values([
      { id: t, name: 'T', slug: 't' },
      { id: o, name: 'O', slug: 'o' },
    ]);
    ctx = createTenantContext({ tenantId: t, userId: newUserId() });
    ctxOther = createTenantContext({ tenantId: o, userId: newUserId() });
  });
  afterEach(async () => {
    await close();
  });

  const base = { givenNames: 'Ana', firstSurname: 'P', birthDate: '1990-01-01' } as const;

  it('registra un procedimiento atribuido al autor y por defecto completado', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    const repo = new ProcedureRepository(db, ctx);
    const proc = await repo.create({ patientId: p.id, code: 'Sutura simple' });
    expect(proc).not.toBeNull();
    expect(proc!.status).toBe('completed');
    expect(proc!.performedBy).toBe(ctx.userId);
    expect(await repo.listForPatient(p.id)).toHaveLength(1);
  });

  it('no registra en paciente de otro tenant; listado aislado', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    expect(
      await new ProcedureRepository(db, ctxOther).create({ patientId: p.id, code: 'X' }),
    ).toBeNull();
    await new ProcedureRepository(db, ctx).create({ patientId: p.id, code: 'Curación' });
    expect(await new ProcedureRepository(db, ctxOther).listForPatient(p.id)).toHaveLength(0);
  });

  it('baja lógica: no borra físicamente, desaparece del listado', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    const repo = new ProcedureRepository(db, ctx);
    const proc = await repo.create({ patientId: p.id, code: 'Biopsia', status: 'completed' });
    expect(await repo.softDelete(proc!.id)).toBe(true);
    expect(await repo.listForPatient(p.id)).toHaveLength(0);
    expect(await repo.softDelete(proc!.id)).toBe(false); // ya dado de baja
  });

  it('ordena por fecha de realización descendente', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    const repo = new ProcedureRepository(db, ctx);
    await repo.create({ patientId: p.id, code: 'Antiguo', performedDate: '2024-01-01' });
    await repo.create({ patientId: p.id, code: 'Reciente', performedDate: '2025-06-01' });
    const list = await repo.listForPatient(p.id);
    expect(list[0]!.code).toBe('Reciente');
  });
});
