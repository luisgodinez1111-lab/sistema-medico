'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { addProcedureAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface ProcedureView {
  id: string;
  code: string;
  status: string;
  performedDate: string | null;
  outcome: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  'in-progress': 'En proceso',
  completed: 'Realizado',
  'not-done': 'No realizado',
  'entered-in-error': 'Error de captura',
};

/**
 * Procedimientos realizados del paciente (§NIVEL 3, FHIR Procedure). Documenta el
 * acto ejecutado con fecha y desenlace; distinto de solicitar un estudio. Permiso
 * `patient.write`.
 */
export function ProcedureManager({
  patientId,
  procedures,
  canWrite,
}: {
  patientId: string;
  procedures: ProcedureView[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(addProcedureAction, INITIAL);

  return (
    <ClinicalCard title="Procedimientos realizados">
      {procedures.length === 0 ? (
        <p className="mos-muted">Sin procedimientos registrados.</p>
      ) : (
        <ul className="mos-list">
          {procedures.map((p) => (
            <li key={p.id} className="mos-list__item">
              <span>
                <strong>{p.code}</strong>
                <br />
                <span className="mos-muted">
                  {STATUS_LABEL[p.status] ?? p.status}
                  {p.performedDate ? ` · ${p.performedDate}` : ''}
                  {p.outcome ? ` · ${p.outcome}` : ''}
                </span>
              </span>
              <Badge tone={p.status === 'completed' ? 'success' : 'neutral'}>
                {STATUS_LABEL[p.status] ?? p.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {state.status !== 'idle' ? (
        <Alert severity={state.status === 'ok' ? 'success' : 'critical'} title="Procedimiento">
          {state.message}
        </Alert>
      ) : null}

      {canWrite ? (
        <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
          <input type="hidden" name="patientId" value={patientId} />
          <label className="mos-field">
            <span>Procedimiento realizado</span>
            <input name="code" type="text" placeholder="p. ej. Curación de herida" />
          </label>
          <label className="mos-field">
            <span>Estado</span>
            <select name="status" defaultValue="completed">
              <option value="completed">Realizado</option>
              <option value="in-progress">En proceso</option>
              <option value="not-done">No realizado</option>
            </select>
          </label>
          <label className="mos-field">
            <span>Fecha (opcional)</span>
            <input name="performedDate" type="date" />
          </label>
          <label className="mos-field">
            <span>Desenlace (opcional)</span>
            <input name="outcome" type="text" placeholder="p. ej. sin complicaciones" />
          </label>
          <div className="mos-form__actions">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? 'Registrando…' : 'Registrar procedimiento'}
            </Button>
          </div>
        </form>
      ) : null}
    </ClinicalCard>
  );
}
