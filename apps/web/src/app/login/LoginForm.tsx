'use client';

import { useActionState } from 'react';
import { Button, Alert } from '@medical-os/design-system';
import { loginAction, type LoginState } from './actions';

const INITIAL: LoginState = { status: 'idle' };

/** Formulario de acceso (email + contraseña). */
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="mos-form" style={{ maxWidth: 360 }}>
      {state.status === 'error' ? (
        <Alert severity="critical" title="No se pudo iniciar sesión">
          {state.message}
        </Alert>
      ) : null}
      <label className="mos-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="mos-field">
        <span>Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <label className="mos-field">
        <span>Código de autenticación (solo si activaste 2FA)</span>
        <input
          name="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="6 dígitos"
        />
      </label>
      <div className="mos-form__actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </div>
    </form>
  );
}
