import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { ClinicalCard, Badge, Alert, Button } from '@medical-os/design-system';
import { getUserMfaState, totpAuthUri } from '@medical-os/db';
import type { UserId } from '@medical-os/shared';
import { getSessionUserId } from '@/server/context';
import { getDb } from '@/server/db';
import { startMfaAction, disableMfaAction } from './actions';
import { ConfirmMfaForm } from './ConfirmMfaForm';

export const dynamic = 'force-dynamic';

/**
 * Seguridad de la cuenta (NIVEL 2/15): activar/desactivar MFA (TOTP). El enrolamiento
 * genera un secreto, muestra el QR para la app de autenticación y exige confirmar con
 * un código antes de activar.
 */
export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ enroll?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const { enroll } = await searchParams;

  const mfa = await getUserMfaState(getDb(), userId as UserId);
  if (!mfa) redirect('/login');

  const enrolling = enroll === '1' && !mfa.enabled && mfa.hasSecret && mfa.secret;
  const qrDataUrl = enrolling
    ? await QRCode.toDataURL(totpAuthUri(mfa.secret!, mfa.email), { margin: 1, width: 200 })
    : null;

  return (
    <div className="mos-page" style={{ maxWidth: 640 }}>
      <h1 className="mos-page__title">Seguridad de la cuenta</h1>
      <p className="mos-page__subtitle">Autenticación de dos factores (2FA / TOTP)</p>

      <ClinicalCard title="Verificación en dos pasos">
        <p>
          Estado:{' '}
          {mfa.enabled ? (
            <Badge tone="success">Activada</Badge>
          ) : (
            <Badge tone="warning">Desactivada</Badge>
          )}
        </p>

        {mfa.enabled ? (
          <>
            <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
              Cada inicio de sesión pedirá un código de tu app de autenticación.
            </p>
            <form action={disableMfaAction} style={{ marginTop: 'var(--space-3)' }}>
              <Button type="submit" variant="danger">
                Desactivar 2FA
              </Button>
            </form>
          </>
        ) : enrolling && qrDataUrl ? (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <p>1. Escanea este código con Google Authenticator, Authy o 1Password:</p>
            <img src={qrDataUrl} alt="Código QR para 2FA" width={200} height={200} />
            <p className="mos-muted">
              ¿No puedes escanear? Ingresa esta clave manualmente:
              <br />
              <code>{mfa.secret}</code>
            </p>
            <p style={{ marginTop: 'var(--space-3)' }}>2. Ingresa el código que muestra la app:</p>
            <ConfirmMfaForm />
          </div>
        ) : (
          <>
            <p className="mos-muted" style={{ marginTop: 'var(--space-2)' }}>
              Añade una segunda capa de seguridad con una app de autenticación (TOTP).
            </p>
            <Alert severity="info" title="Recomendado">
              El 2FA protege tu cuenta aunque tu contraseña se vea comprometida.
            </Alert>
            <form action={startMfaAction} style={{ marginTop: 'var(--space-3)' }}>
              <Button type="submit" variant="primary">
                Activar 2FA
              </Button>
            </form>
          </>
        )}
      </ClinicalCard>
    </div>
  );
}
