import { redirect } from 'next/navigation';
import { listSpecialtyPacks, userHasActiveTenant } from '@medical-os/db';
import type { UserId } from '@medical-os/shared';
import { getSessionUserId } from '@/server/context';
import { getDb } from '@/server/db';
import { OnboardingForm } from './OnboardingForm';

export const dynamic = 'force-dynamic';

/**
 * Onboarding (§28 paso 1). Un usuario autenticado sin clínica crea la suya y
 * queda como administrador. Si ya tiene clínica, va al inicio. Sin sesión, al login.
 */
export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  if (await userHasActiveTenant(getDb(), userId as UserId)) redirect('/');

  const packs = listSpecialtyPacks().map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mos-page" style={{ maxWidth: 600 }}>
      <h1 className="mos-page__title">Crea tu clínica</h1>
      <p className="mos-page__subtitle">
        Configura tu organización para empezar. Quedarás como administrador.
      </p>
      <OnboardingForm packs={packs} />
    </div>
  );
}
