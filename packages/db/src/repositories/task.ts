import { and, eq, desc, ne, isNull } from 'drizzle-orm';
import { newTaskId, type TaskId, type PatientId, type UserId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { task, patient } from '../schema';

export type TaskRow = (typeof task)['$inferSelect'];
export type TaskType = 'result-review' | 'clinical-followup' | 'arco-request' | 'general';
export type TaskPriority = 'routine' | 'urgent';

export interface NewTaskInput {
  patientId?: PatientId;
  type?: TaskType;
  title: string;
  note?: string;
  priority?: TaskPriority;
  ownerId?: UserId;
  dueDate?: string;
}

/**
 * Tareas / obligaciones clínicas (§NIVEL 3, §NIVEL 9). Tenant-scoped. Toda tarea
 * tiene estado y criterio de cierre; ninguna obligación queda sin propietario ni
 * cierre (§0). Cerrar = `completed`/`cancelled` con autor y fecha, nunca borrado.
 */
export class TaskRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  private async patientInTenant(patientId: PatientId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: patient.id })
      .from(patient)
      .where(
        and(
          eq(patient.id, patientId),
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** Tareas abiertas del tenant (Command Center): urgentes primero, luego por fecha. */
  async listOpen(limit = 50): Promise<TaskRow[]> {
    const rows = await this.db
      .select()
      .from(task)
      .where(and(eq(task.tenantId, this.ctx.tenantId), ne(task.status, 'completed')))
      .orderBy(desc(task.priority), desc(task.createdAt))
      .limit(limit);
    return (rows as TaskRow[]).filter((t) => t.status !== 'cancelled');
  }

  async listForPatient(patientId: PatientId): Promise<TaskRow[]> {
    const rows = await this.db
      .select()
      .from(task)
      .where(and(eq(task.tenantId, this.ctx.tenantId), eq(task.patientId, patientId)))
      .orderBy(desc(task.createdAt));
    return rows as TaskRow[];
  }

  /** Crea una tarea. Si trae `patientId`, valida que sea del tenant. */
  async create(input: NewTaskInput): Promise<TaskRow | null> {
    if (input.patientId && !(await this.patientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(task)
      .values({
        id: newTaskId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId ?? null,
        type: input.type ?? 'general',
        title: input.title,
        note: input.note ?? null,
        priority: input.priority ?? 'routine',
        ownerId: input.ownerId ?? this.ctx.userId,
        dueDate: input.dueDate ?? null,
        createdBy: this.ctx.userId,
      })
      .returning();
    return created as TaskRow;
  }

  /** Cierra la tarea como completada (atribuida y fechada). */
  async complete(id: TaskId): Promise<boolean> {
    const [updated] = await this.db
      .update(task)
      .set({
        status: 'completed',
        completedBy: this.ctx.userId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(task.id, id), eq(task.tenantId, this.ctx.tenantId), ne(task.status, 'completed')),
      )
      .returning({ id: task.id });
    return Boolean(updated);
  }

  /** Cancela la tarea (obligación descartada con criterio, no borrado). */
  async cancel(id: TaskId): Promise<boolean> {
    const [updated] = await this.db
      .update(task)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(task.id, id), eq(task.tenantId, this.ctx.tenantId), eq(task.status, 'open')))
      .returning({ id: task.id });
    return Boolean(updated);
  }
}
