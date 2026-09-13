'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { createAppointmentAction, type AgendaActionState } from './actions';

const INITIAL: AgendaActionState = { status: 'idle' };

/** Alta de cita por MRN del paciente (R3). */
export function NewAppointmentForm() {
  const [state, action, pending] = useActionState(createAppointmentAction, INITIAL);
  return (
    <ClinicalCard title="Agendar cita">
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo agendar">
          {state.message}
        </Alert>
      ) : state.status === 'ok' ? (
        <Alert severity="success" title="Agendada">
          {state.message}
        </Alert>
      ) : null}
      <form action={action} className="mos-form">
        <div className="mos-field-grid">
          <label className="mos-field">
            <span>MRN del paciente</span>
            <input name="mrn" required placeholder="p.ej. 000123" />
          </label>
          <label className="mos-field">
            <span>Fecha y hora</span>
            <input name="startAt" type="datetime-local" required />
          </label>
          <label className="mos-field">
            <span>Duración (min)</span>
            <input name="durationMinutes" type="number" defaultValue={30} min={5} step={5} />
          </label>
          <label className="mos-field">
            <span>Motivo</span>
            <input name="reason" placeholder="p.ej. Control" />
          </label>
        </div>
        <div className="mos-form__actions">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Agendando…' : 'Agendar'}
          </Button>
        </div>
      </form>
    </ClinicalCard>
  );
}
