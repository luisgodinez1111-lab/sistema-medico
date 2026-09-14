'use client';

import { useActionState } from 'react';
import { ClinicalCard, Button, Alert, Badge } from '@medical-os/design-system';
import { grantConsentAction, revokeConsentAction, type AllergyActionState } from './actions';

const INITIAL: AllergyActionState = { status: 'idle' };

export interface ConsentView {
  id: string;
  type: string;
  status: string;
  grantedAt: string;
  revokedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  'privacy-notice': 'Aviso de privacidad',
  treatment: 'Consentimiento de atención',
  'data-sharing': 'Transferencia de datos',
  'informed-procedure': 'Consentimiento informado (procedimiento)',
};

/**
 * Consentimientos del paciente (§26 LFPDPPP/NOM-024). Otorgar/revocar; revocar no
 * borra (histórico verificable para cumplimiento). Permiso `patient.write`.
 */
export function ConsentManager({
  patientId,
  consents,
  canWrite,
}: {
  patientId: string;
  consents: ConsentView[];
  canWrite: boolean;
}) {
  const [grantState, grantAction, granting] = useActionState(grantConsentAction, INITIAL);
  const [revokeState, revokeAction, revoking] = useActionState(revokeConsentAction, INITIAL);

  return (
    <ClinicalCard title="Consentimientos">
      {consents.length === 0 ? (
        <p className="mos-muted">Sin consentimientos registrados.</p>
      ) : (
        <ul className="mos-list">
          {consents.map((c) => (
            <li key={c.id} className="mos-list__item">
              <span>
                {TYPE_LABEL[c.type] ?? c.type}
                <br />
                <span className="mos-muted">
                  {c.status === 'active'
                    ? `otorgado ${c.grantedAt.slice(0, 10)}`
                    : `revocado ${(c.revokedAt ?? '').slice(0, 10)}`}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {canWrite && c.status === 'active' ? (
                  <form action={revokeAction}>
                    <input type="hidden" name="patientId" value={patientId} />
                    <input type="hidden" name="consentId" value={c.id} />
                    <Button type="submit" variant="ghost" disabled={revoking}>
                      Revocar
                    </Button>
                  </form>
                ) : null}
                <Badge tone={c.status === 'active' ? 'success' : 'neutral'}>
                  {c.status === 'active' ? 'Activo' : 'Revocado'}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}

      {grantState.status !== 'idle' ? (
        <Alert
          severity={grantState.status === 'ok' ? 'success' : 'critical'}
          title="Consentimiento"
        >
          {grantState.message}
        </Alert>
      ) : revokeState.status === 'error' ? (
        <Alert severity="critical" title="Error">
          {revokeState.message}
        </Alert>
      ) : null}

      {canWrite ? (
        <form action={grantAction} className="mos-form" style={{ marginTop: 'var(--space-3)' }}>
          <input type="hidden" name="patientId" value={patientId} />
          <label className="mos-field">
            <span>Registrar consentimiento</span>
            <select name="type" defaultValue="privacy-notice">
              <option value="privacy-notice">Aviso de privacidad</option>
              <option value="treatment">Consentimiento de atención</option>
              <option value="data-sharing">Transferencia de datos</option>
              <option value="informed-procedure">Consentimiento informado (procedimiento)</option>
            </select>
          </label>
          <div className="mos-form__actions">
            <Button type="submit" variant="secondary" disabled={granting}>
              {granting ? 'Registrando…' : 'Registrar'}
            </Button>
          </div>
        </form>
      ) : null}
    </ClinicalCard>
  );
}
