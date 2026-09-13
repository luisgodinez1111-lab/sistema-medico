'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert } from '@medical-os/design-system';
import { addAddendumAction, type AllergyActionState } from '../../actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface AddendumView {
  id: string;
  text: string;
  createdAt: string;
}

/**
 * Enmiendas de una nota firmada (§NIVEL 6, §33 #6). La nota original es inmutable;
 * aquí sólo se AÑADEN enmiendas fechadas. Requiere autoridad de firma.
 */
export function AddendumManager({
  patientId,
  encounterId,
  addenda,
  canAmend,
}: {
  patientId: string;
  encounterId: string;
  addenda: AddendumView[];
  canAmend: boolean;
}) {
  const [state, action, pending] = useActionState(addAddendumAction, INITIAL);

  return (
    <ClinicalCard title="Enmiendas (addenda)">
      <p className="mos-muted">
        La nota firmada no se edita; una corrección se anexa como enmienda fechada.
      </p>

      {addenda.length === 0 ? (
        <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
          Sin enmiendas.
        </p>
      ) : (
        <ul className="mos-list" style={{ marginTop: 'var(--space-2)' }}>
          {addenda.map((a) => (
            <li key={a.id} className="mos-list__item">
              <span>{a.text}</span>
              <span className="mos-muted">{a.createdAt.slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
        </ul>
      )}

      {canAmend ? (
        <>
          {state.status !== 'idle' ? (
            <Alert severity={state.status === 'ok' ? 'success' : 'critical'} title="Enmienda">
              {state.message}
            </Alert>
          ) : null}
          <form action={action} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="encounterId" value={encounterId} />
            <label className="mos-field">
              <span>Nueva enmienda</span>
              <textarea name="text" rows={2} required placeholder="Corrección o aclaración…" />
            </label>
            <div className="mos-form__actions">
              <Button type="submit" variant="secondary" disabled={pending}>
                {pending ? 'Agregando…' : 'Agregar enmienda'}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <p className="mos-muted">Requiere permiso de firma (`encounter.sign`) para enmendar.</p>
      )}
    </ClinicalCard>
  );
}
