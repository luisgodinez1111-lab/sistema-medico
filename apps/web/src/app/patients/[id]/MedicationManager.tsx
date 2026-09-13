'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { prescribeMedicationAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface MedicationView {
  id: string;
  drug: string;
  dose: string | null;
  route: string;
  frequency: string | null;
}

/**
 * Medicación activa + prescripción con seguridad (§NIVEL 8). Si la acción
 * devuelve una alerta crítica (alergia), se muestran las alertas y se habilita
 * "Prescribir de todas formas" (reenvía con confirm=1). Todo server-side.
 */
export function MedicationManager({
  patientId,
  medications,
  canWrite,
}: {
  patientId: string;
  medications: MedicationView[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState(prescribeMedicationAction, INITIAL);
  const blocking = state.status === 'alerts';
  const hasCriticalAlert = (state.alerts ?? []).some((a) => a.severity === 'critical');

  return (
    <ClinicalCard title="Medicación actual">
      {medications.length === 0 ? (
        <p className="mos-muted">Sin medicación activa.</p>
      ) : (
        <ul className="mos-list">
          {medications.map((m) => (
            <li key={m.id} className="mos-list__item">
              <span>
                <strong>{m.drug}</strong> {m.dose ?? ''}
                <br />
                <span className="mos-muted">
                  {m.route}
                  {m.frequency ? ` · ${m.frequency}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!canWrite ? null : (
        <>
          {state.status === 'ok' ? (
            <Alert severity="success" title="Prescripción">
              {state.message}
            </Alert>
          ) : null}
          {state.status === 'error' ? (
            <Alert severity="critical" title="Error">
              {state.message}
            </Alert>
          ) : null}
          {(state.alerts ?? []).length > 0 ? (
            <Alert
              severity={hasCriticalAlert ? 'critical' : 'warning'}
              title={hasCriticalAlert ? 'Alerta de seguridad' : 'Advertencia'}
            >
              <ul className="mos-list" style={{ marginTop: 'var(--space-2)' }}>
                {state.alerts!.map((a, i) => (
                  <li key={i} className="mos-list__item">
                    <span>{a.message}</span>
                    <Badge tone={a.severity === 'critical' ? 'critical' : 'warning'}>
                      {a.code}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <div className="mos-field-grid">
              <label className="mos-field">
                <span>Medicamento</span>
                <input name="drug" required placeholder="p.ej. Amoxicilina" />
              </label>
              <label className="mos-field">
                <span>Dosis</span>
                <input name="dose" placeholder="p.ej. 500 mg" />
              </label>
              <label className="mos-field">
                <span>Vía</span>
                <select name="route" defaultValue="oral">
                  <option value="oral">Oral</option>
                  <option value="iv">IV</option>
                  <option value="im">IM</option>
                  <option value="sc">SC</option>
                  <option value="topical">Tópica</option>
                  <option value="inhaled">Inhalada</option>
                  <option value="other">Otra</option>
                </select>
              </label>
              <label className="mos-field">
                <span>Frecuencia</span>
                <input name="frequency" placeholder="p.ej. c/8h" />
              </label>
              <label className="mos-field">
                <span>Duración (días)</span>
                <input name="durationDays" placeholder="p.ej. 7" />
              </label>
            </div>
            {/* confirm=1 sólo cuando el usuario decide prescribir pese a la alerta crítica. */}
            <input type="hidden" name="confirm" value={blocking ? '1' : '0'} />
            <div className="mos-form__actions">
              <Button type="submit" variant={blocking ? 'secondary' : 'primary'} disabled={pending}>
                {pending ? 'Procesando…' : blocking ? 'Prescribir de todas formas' : 'Prescribir'}
              </Button>
            </div>
          </form>
        </>
      )}
    </ClinicalCard>
  );
}
