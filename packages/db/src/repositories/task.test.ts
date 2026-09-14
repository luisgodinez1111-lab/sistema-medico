import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { eq } from 'drizzle-orm';
import { tenant, task } from '../schema';
import { PatientRepository } from './patient';
import { TaskRepository } from './task';

describe('TaskRepository (§NIVEL 3 obligaciones / §NIVEL 9 ownership)', () => {
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

  it('crea tarea atribuida al autor y por defecto abierta/rutina', async () => {
    const repo = new TaskRepository(db, ctx);
    const task = await repo.create({ title: 'Llamar al paciente' });
    expect(task).not.toBeNull();
    expect(task!.status).toBe('open');
    expect(task!.priority).toBe('routine');
    expect(task!.type).toBe('general');
    expect(task!.createdBy).toBe(ctx.userId);
    expect(task!.ownerId).toBe(ctx.userId);
  });

  it('listOpen prioriza urgentes y excluye completadas/canceladas', async () => {
    const repo = new TaskRepository(db, ctx);
    await repo.create({ title: 'Rutina' });
    const urgent = await repo.create({ title: 'Urgente', priority: 'urgent' });
    const done = await repo.create({ title: 'Terminada' });
    const cancelled = await repo.create({ title: 'Cancelada' });
    await repo.complete(done!.id);
    await repo.cancel(cancelled!.id);

    const open = await repo.listOpen();
    expect(open).toHaveLength(2);
    expect(open[0]!.id).toBe(urgent!.id); // urgente primero
    expect(open.map((t) => t.title)).not.toContain('Terminada');
    expect(open.map((t) => t.title)).not.toContain('Cancelada');
  });

  it('complete cierra con autor y fecha; no reabre ya completada', async () => {
    const repo = new TaskRepository(db, ctx);
    const t = await repo.create({ title: 'Revisar resultado', type: 'result-review' });
    expect(await repo.complete(t!.id)).toBe(true);
    expect(await repo.complete(t!.id)).toBe(false); // idempotente
    const [row] = await db.select().from(task).where(eq(task.id, t!.id));
    expect(row!.status).toBe('completed');
    expect(row!.completedBy).toBe(ctx.userId);
    expect(row!.completedAt).not.toBeNull();
  });

  it('valida paciente del tenant al crear y aísla el listado por tenant', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    // Otro tenant no puede crear tarea sobre un paciente ajeno.
    expect(
      await new TaskRepository(db, ctxOther).create({ patientId: p.id, title: 'X' }),
    ).toBeNull();
    // El tenant dueño sí, y queda aislado.
    await new TaskRepository(db, ctx).create({ patientId: p.id, title: 'Seguimiento' });
    expect(await new TaskRepository(db, ctx).listForPatient(p.id)).toHaveLength(1);
    expect(await new TaskRepository(db, ctxOther).listForPatient(p.id)).toHaveLength(0);
  });

  it('cancel solo aplica a tareas abiertas', async () => {
    const repo = new TaskRepository(db, ctx);
    const t = await repo.create({ title: 'Descartable' });
    expect(await repo.cancel(t!.id)).toBe(true);
    expect(await repo.cancel(t!.id)).toBe(false);
  });
});
