'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import {
  createTaskAction,
  completeTaskAction,
  cancelTaskAction,
  type AllergyActionState,
} from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface TaskView {
  id: string;
  type: string;
  title: string;
  note: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  'result-review': 'Revisión de resultado',
  'clinical-followup': 'Seguimiento clínico',
  'arco-request': 'Solicitud ARCO',
  general: 'General',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  'in-progress': 'En proceso',
  completed: 'Cerrado',
  cancelled: 'Cancelado',
};

/**
 * Pendientes / obligaciones clínicas del paciente (§NIVEL 3, §NIVEL 9). Toda
 * tarea tiene dueño y criterio de cierre; cerrar/cancelar no borra. Muestra los
 * abiertos primero. Permiso `patient.write`.
 */
export function TaskManager({
  patientId,
  tasks,
  canWrite,
}: {
  patientId: string;
  tasks: TaskView[];
  canWrite: boolean;
}) {
  const [createState, createAction, creating] = useActionState(createTaskAction, INITIAL);
  const [completeState, completeAction, completing] = useActionState(completeTaskAction, INITIAL);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelTaskAction, INITIAL);

  const open = tasks.filter((t) => t.status === 'open' || t.status === 'in-progress');
  const closed = tasks.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  return (
    <ClinicalCard title="Pendientes clínicos">
      {open.length === 0 ? (
        <p className="mos-muted">Sin pendientes abiertos.</p>
      ) : (
        <ul className="mos-list">
          {open.map((t) => (
            <li key={t.id} className="mos-list__item">
              <span>
                <strong>{t.title}</strong>
                <br />
                <span className="mos-muted">
                  {TYPE_LABEL[t.type] ?? t.type}
                  {t.dueDate ? ` · vence ${t.dueDate}` : ''}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Badge tone={t.priority === 'urgent' ? 'critical' : 'neutral'}>
                  {t.priority === 'urgent' ? 'Urgente' : 'Rutina'}
                </Badge>
                {canWrite ? (
                  <>
                    <form action={completeAction}>
                      <input type="hidden" name="patientId" value={patientId} />
                      <input type="hidden" name="taskId" value={t.id} />
                      <Button type="submit" variant="secondary" disabled={completing}>
                        Cerrar
                      </Button>
                    </form>
                    <form action={cancelAction}>
                      <input type="hidden" name="patientId" value={patientId} />
                      <input type="hidden" name="taskId" value={t.id} />
                      <Button type="submit" variant="ghost" disabled={cancelling}>
                        Cancelar
                      </Button>
                    </form>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 ? (
        <details style={{ marginTop: 'var(--space-3)' }}>
          <summary className="mos-muted">Cerrados / cancelados ({closed.length})</summary>
          <ul className="mos-list">
            {closed.map((t) => (
              <li key={t.id} className="mos-list__item">
                <span>
                  {t.title}
                  <br />
                  <span className="mos-muted">
                    {STATUS_LABEL[t.status] ?? t.status}
                    {t.completedAt ? ` · ${t.completedAt.slice(0, 10)}` : ''}
                  </span>
                </span>
                <Badge tone="neutral">{STATUS_LABEL[t.status] ?? t.status}</Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {createState.status !== 'idle' ? (
        <Alert severity={createState.status === 'ok' ? 'success' : 'critical'} title="Pendiente">
          {createState.message}
        </Alert>
      ) : completeState.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {completeState.message}
        </Alert>
      ) : cancelState.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {cancelState.message}
        </Alert>
      ) : null}

      {canWrite ? (
        <form action={createAction} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
          <input type="hidden" name="patientId" value={patientId} />
          <label className="mos-field">
            <span>Nuevo pendiente</span>
            <input name="title" type="text" placeholder="p. ej. Llamar con resultados de TSH" />
          </label>
          <label className="mos-field">
            <span>Tipo</span>
            <select name="type" defaultValue="clinical-followup">
              <option value="clinical-followup">Seguimiento clínico</option>
              <option value="result-review">Revisión de resultado</option>
              <option value="arco-request">Solicitud ARCO</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Prioridad</span>
            <select name="priority" defaultValue="routine">
              <option value="routine">Rutina</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Vence (opcional)</span>
            <input name="dueDate" type="date" />
          </label>
          <div className="mos-form__actions">
            <Button type="submit" variant="secondary" disabled={creating}>
              {creating ? 'Creando…' : 'Crear pendiente'}
            </Button>
          </div>
        </form>
      ) : null}
    </ClinicalCard>
  );
}
