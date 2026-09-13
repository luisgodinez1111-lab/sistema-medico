'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { addVitalAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface VitalView {
  id: string;
  code: string;
  valueText: string;
  unit: string | null;
  effectiveAt: string;
}

/** Etiquetas legibles para los códigos de signos vitales comunes. */
const VITAL_LABEL: Record<string, string> = {
  'blood-pressure': 'Tensión arterial',
  'heart-rate': 'Frecuencia cardiaca',
  'respiratory-rate': 'Frecuencia respiratoria',
  temperature: 'Temperatura',
  weight: 'Peso',
  height: 'Talla',
  spo2: 'SpO₂',
};

function vitalLabel(code: string): string {
  return VITAL_LABEL[code] ?? code;
}

/**
 * Lista y alta de signos vitales del paciente (§NIVEL 3, §28 paso 6).
 * Autorización y scoping en el servidor.
 */
export function VitalsManager({
  patientId,
  vitals,
  canWrite,
}: {
  patientId: string;
  vitals: VitalView[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(addVitalAction, INITIAL);

  return (
    <ClinicalCard title="Signos vitales">
      {vitals.length === 0 ? (
        <p className="mos-muted">Sin signos vitales registrados.</p>
      ) : (
        <ul className="mos-list">
          {vitals.map((v) => (
            <li key={v.id} className="mos-list__item">
              <span>
                {vitalLabel(v.code)}:{' '}
                <strong>
                  {v.valueText}
                  {v.unit ? ` ${v.unit}` : ''}
                </strong>
              </span>
              <span className="mos-muted">{v.effectiveAt.slice(0, 10)}</span>
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
                <span>Signo vital</span>
                <select name="code" defaultValue="blood-pressure">
                  <option value="blood-pressure">Tensión arterial</option>
                  <option value="heart-rate">Frecuencia cardiaca</option>
                  <option value="respiratory-rate">Frecuencia respiratoria</option>
                  <option value="temperature">Temperatura</option>
                  <option value="weight">Peso</option>
                  <option value="height">Talla</option>
                  <option value="spo2">SpO₂</option>
                </select>
              </label>
              <label className="mos-field">
                <span>Valor</span>
                <input name="valueText" required placeholder="p.ej. 138/86" />
              </label>
              <label className="mos-field">
                <span>Unidad (opcional)</span>
                <input name="unit" placeholder="p.ej. mmHg" />
              </label>
            </div>
            <div className="mos-form__actions">
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Guardando…' : 'Registrar signo vital'}
              </Button>
            </div>
          </form>
        </>
      )}
    </ClinicalCard>
  );
}
