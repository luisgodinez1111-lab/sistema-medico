'use client';

import { useActionState } from 'react';
import { Button, Alert } from '@medical-os/design-system';
import { confirmMfaAction, type MfaState } from './actions';

const INITIAL: MfaState = { status: 'idle' };

/** Paso final del enrolamiento: confirmar con un código de la app. */
export function ConfirmMfaForm() {
  const [state, action, pending] = useActionState(confirmMfaAction, INITIAL);
  return (
    <form action={action} className="mos-form" style={{ maxWidth: 320 }}>
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo activar">
          {state.message}
        </Alert>
      ) : null}
      <label className="mos-field">
        <span>Código de tu app (6 dígitos)</span>
        <input
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          placeholder="123456"
        />
      </label>
      <div className="mos-form__actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Verificando…' : 'Activar 2FA'}
        </Button>
      </div>
    </form>
  );
}
