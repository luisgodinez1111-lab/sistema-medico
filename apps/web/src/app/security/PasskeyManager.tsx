'use client';

import { useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  deletePasskeyAction,
} from './passkey-actions';

export interface PasskeyView {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

type Feedback = { tone: 'success' | 'critical'; message: string } | null;

/**
 * Gestión de passkeys / WebAuthn (§NIVEL 2/15). Registrar (ceremonia en el
 * navegador vía `startRegistration`), listar y eliminar. La llave privada nunca
 * sale del dispositivo; el servidor sólo verifica y guarda material público.
 */
export function PasskeyManager({ passkeys }: { passkeys: PasskeyView[] }) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');

  async function register() {
    setFeedback(null);
    // 1) Opciones + challenge desde el servidor.
    const opt = await getPasskeyRegistrationOptions();
    if (!opt.ok || !opt.options) {
      setFeedback({ tone: 'critical', message: opt.error ?? 'No se pudo iniciar el registro.' });
      return;
    }
    // 2) Ceremonia WebAuthn en el navegador.
    let attResp;
    try {
      attResp = await startRegistration({ optionsJSON: opt.options });
    } catch (e) {
      const msg =
        e instanceof Error && e.name === 'InvalidStateError'
          ? 'Esta llave ya está registrada.'
          : 'Registro cancelado o no soportado por el dispositivo.';
      setFeedback({ tone: 'critical', message: msg });
      return;
    }
    // 3) Verificación + persistencia en el servidor.
    const result = await verifyPasskeyRegistration(attResp, name);
    if (!result.ok) {
      setFeedback({ tone: 'critical', message: result.error ?? 'No se pudo verificar.' });
      return;
    }
    setName('');
    setFeedback({ tone: 'success', message: 'Passkey registrada.' });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePasskeyAction(id);
      setFeedback(
        result.ok
          ? { tone: 'success', message: 'Passkey eliminada.' }
          : { tone: 'critical', message: result.error ?? 'No se pudo eliminar.' },
      );
    });
  }

  return (
    <ClinicalCard title="Llaves de acceso (passkeys)">
      <p className="mos-muted">
        Inicia sesión sin contraseña con la biometría o el PIN de tu dispositivo. Más resistente al
        phishing que un código.
      </p>

      {passkeys.length === 0 ? (
        <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
          Aún no tienes passkeys registradas.
        </p>
      ) : (
        <ul className="mos-list" style={{ marginTop: 'var(--space-2)' }}>
          {passkeys.map((p) => (
            <li key={p.id} className="mos-list__item">
              <span>
                <strong>{p.name ?? 'Passkey'}</strong>
                <br />
                <span className="mos-muted">
                  {p.deviceType === 'multiDevice' ? 'Sincronizable' : 'De dispositivo'}
                  {p.backedUp ? ' · respaldada' : ''} · alta {p.createdAt.slice(0, 10)}
                  {p.lastUsedAt ? ` · último uso ${p.lastUsedAt.slice(0, 10)}` : ''}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {p.backedUp ? <Badge tone="success">Respaldada</Badge> : null}
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(p.id)}
                >
                  Eliminar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {feedback ? (
        <Alert severity={feedback.tone === 'success' ? 'success' : 'critical'} title="Passkey">
          {feedback.message}
        </Alert>
      ) : null}

      <div className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
        <label className="mos-field">
          <span>Nombre de la passkey (opcional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. iPhone de la Dra."
          />
        </label>
        <div className="mos-form__actions">
          <Button type="button" variant="primary" disabled={pending} onClick={register}>
            Registrar passkey
          </Button>
        </div>
      </div>
    </ClinicalCard>
  );
}
