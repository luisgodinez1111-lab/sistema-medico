'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { saveEncounterDiagnosesAction, type AllergyActionState } from '../../actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface ConditionOption {
  id: string;
  code: string;
}

/**
 * Diagnósticos del encuentro (§28 paso 7). Marca cuáles problemas activos del
 * paciente se abordan hoy; de aquí se deriva el Análisis (A) de la nota, que la
 * firma congela. Los problemas nuevos se crean en el expediente (ConditionManager).
 */
export function DiagnosisManager({
  patientId,
  encounterId,
  conditions,
  selectedIds,
}: {
  patientId: string;
  encounterId: string;
  conditions: ConditionOption[];
  selectedIds: string[];
}) {
  const [state, action, pending] = useActionState(saveEncounterDiagnosesAction, INITIAL);
  const selected = new Set(selectedIds);

  return (
    <ClinicalCard title="Diagnósticos del encuentro (Análisis)">
      <p className="mos-muted">
        Marca los problemas abordados hoy. El Análisis (A) de la nota se genera de aquí.
      </p>
      {state.status !== 'idle' ? (
        <Alert severity={state.status === 'ok' ? 'success' : 'critical'} title="Diagnósticos">
          {state.message}
        </Alert>
      ) : null}

      {conditions.length === 0 ? (
        <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
          El paciente no tiene problemas activos. Agrégalos en el expediente para poder diagnosticar
          en el encuentro.
        </p>
      ) : (
        <form action={action} className="mos-form" style={{ marginTop: 'var(--space-2)' }}>
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="encounterId" value={encounterId} />
          {conditions.map((c) => (
            <label
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <input
                type="checkbox"
                name="conditionId"
                value={c.id}
                defaultChecked={selected.has(c.id)}
              />
              <span>{c.code}</span>
            </label>
          ))}
          <div className="mos-form__actions">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar diagnósticos'}
            </Button>
          </div>
        </form>
      )}
    </ClinicalCard>
  );
}
