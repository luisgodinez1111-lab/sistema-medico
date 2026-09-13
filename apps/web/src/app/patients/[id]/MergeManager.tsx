'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { mergePatientAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

/**
 * Fusión de duplicados (§NIVEL 3, §28 paso 2). El paciente ACTUAL es el
 * duplicado; se indica el MRN del superviviente. Los datos clínicos se reasignan
 * y este expediente queda marcado como fusionado (baja lógica, reversible).
 */
export function MergeManager({ patientId, canWrite }: { patientId: string; canWrite: boolean }) {
  const [state, action, pending] = useActionState(mergePatientAction, INITIAL);
  if (!canWrite) return null;

  return (
    <ClinicalCard title="Fusionar duplicado">
      <p className="mos-muted">
        Marca ESTE expediente como duplicado de otro. Sus alergias, problemas, signos vitales y
        contactos se moverán al paciente superviviente. Es reversible (baja lógica), pero cámbialo
        con cuidado.
      </p>
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo fusionar">
          {state.message}
        </Alert>
      ) : null}
      <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
        <input type="hidden" name="loserId" value={patientId} />
        <label className="mos-field">
          <span>MRN del paciente superviviente</span>
          <input name="winnerMrn" required placeholder="p.ej. 000123" />
        </label>
        <div className="mos-form__actions">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Fusionando…' : 'Fusionar en ese paciente'}
          </Button>
        </div>
      </form>
    </ClinicalCard>
  );
}
