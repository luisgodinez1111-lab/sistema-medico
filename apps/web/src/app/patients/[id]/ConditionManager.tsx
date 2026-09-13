'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { addConditionAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface ConditionView {
  id: string;
  code: string;
  onsetDate: string | null;
}

/**
 * Lista y alta de problemas activos del paciente (§NIVEL 3, §28 paso 7).
 * La autorización y el scoping ocurren en el servidor.
 */
export function ConditionManager({
  patientId,
  conditions,
  canWrite,
}: {
  patientId: string;
  conditions: ConditionView[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(addConditionAction, INITIAL);

  return (
    <ClinicalCard title="Problemas activos">
      {conditions.length === 0 ? (
        <p className="mos-muted">Sin problemas activos registrados.</p>
      ) : (
        <ul className="mos-list">
          {conditions.map((c) => (
            <li key={c.id} className="mos-list__item">
              <span>{c.code}</span>
              {c.onsetDate ? <span className="mos-muted">desde {c.onsetDate}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {!canWrite ? null : (
        <>
          {state.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {state.message}
            </Alert>
          ) : null}
          <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <div className="mos-field-grid">
              <label className="mos-field">
                <span>Problema / diagnóstico</span>
                <input name="code" required placeholder="p.ej. Diabetes mellitus tipo 2" />
              </label>
              <label className="mos-field">
                <span>Inicio (opcional)</span>
                <input name="onsetDate" type="date" />
              </label>
            </div>
            <div className="mos-form__actions">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Guardando…' : 'Registrar problema'}
              </Button>
            </div>
          </form>
        </>
      )}
    </ClinicalCard>
  );
}
