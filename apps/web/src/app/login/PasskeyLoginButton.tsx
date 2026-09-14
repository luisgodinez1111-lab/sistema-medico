'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { startAuthentication } from '@simplewebauthn/browser';
import { Button, Alert } from '@medical-os/design-system';

/**
 * Inicio de sesión con passkey (§NIVEL 2/15). Pide opciones al endpoint público
 * (que fija la cookie del challenge), ejecuta la ceremonia en el navegador y envía
 * la aserción al provider `passkey` de Auth.js vía signIn.
 */
export function PasskeyLoginButton() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loginWithPasskey() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/webauthn/authenticate/options', { cache: 'no-store' });
      if (!res.ok) throw new Error('options');
      const optionsJSON = await res.json();
      const assertion = await startAuthentication({ optionsJSON });
      const result = await signIn('passkey', {
        assertion: JSON.stringify(assertion),
        redirect: false,
      });
      if (result?.error) {
        setError('No se pudo iniciar sesión con la passkey.');
        setBusy(false);
        return;
      }
      window.location.href = '/';
    } catch (e) {
      if (e instanceof Error && e.name === 'NotAllowedError') {
        setError('Operación cancelada.');
      } else {
        setError('Tu dispositivo no completó la verificación con passkey.');
      }
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      {error ? (
        <Alert severity="critical" title="Passkey">
          {error}
        </Alert>
      ) : null}
      <Button type="button" variant="secondary" disabled={busy} onClick={loginWithPasskey}>
        {busy ? 'Verificando…' : 'Entrar con passkey'}
      </Button>
    </div>
  );
}
