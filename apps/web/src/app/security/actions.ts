'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  generateTotpSecret,
  setUserMfaSecret,
  enableUserMfa,
  disableUserMfa,
} from '@medical-os/db';
import type { UserId } from '@medical-os/shared';
import { getSessionUserId } from '@/server/context';
import { getDb } from '@/server/db';

export interface MfaState {
  status: 'idle' | 'error';
  message?: string;
}

/** Inicia el enrolamiento: genera y guarda un secreto TOTP (aún no activa MFA). */
export async function startMfaAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  await setUserMfaSecret(getDb(), userId as UserId, generateTotpSecret());
  redirect('/security?enroll=1');
}

/** Confirma el enrolamiento con un código válido de la app de autenticación. */
export async function confirmMfaAction(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const userId = await getSessionUserId();
  if (!userId) return { status: 'error', message: 'Sin sesión válida.' };
  const token = (formData.get('token') ?? '').toString().trim();
  if (!/^\d{6}$/.test(token))
    return { status: 'error', message: 'Ingresa el código de 6 dígitos.' };

  const ok = await enableUserMfa(getDb(), userId as UserId, token);
  if (!ok) {
    return { status: 'error', message: 'Código incorrecto. Verifica la hora de tu dispositivo.' };
  }
  revalidatePath('/security');
  redirect('/security');
}

/** Desactiva MFA y borra el secreto. */
export async function disableMfaAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  await disableUserMfa(getDb(), userId as UserId);
  redirect('/security');
}
