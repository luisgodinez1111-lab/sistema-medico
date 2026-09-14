'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { signIn, signOut } from '@/auth';
import { rateLimit } from '@/server/rate-limit';

export interface LoginState {
  status: 'idle' | 'error';
  message?: string;
}

/** IP del cliente desde las cabeceras del proxy (Vercel). */
async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'unknown';
}

/**
 * Inicia sesión con email + contraseña (Auth.js Credentials). En éxito, signIn
 * lanza un redirect (que debe propagarse). Un fallo de credenciales se traduce a
 * un mensaje genérico — no se revela si el email existe (§NIVEL 2). Rate-limited
 * por IP contra fuerza bruta (NIVEL 15).
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') ?? '').toString().trim();
  const password = (formData.get('password') ?? '').toString();
  if (!email || !password) {
    return { status: 'error', message: 'Ingresa email y contraseña.' };
  }

  // Máx. 10 intentos por IP cada 5 min (contra fuerza bruta).
  const rl = await rateLimit(`login:${await clientIp()}`, { limit: 10, windowSec: 300 });
  if (!rl.ok) {
    return {
      status: 'error',
      message: `Demasiados intentos. Espera ${Math.ceil(rl.retryAfterSec / 60)} min e inténtalo de nuevo.`,
    };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
    return { status: 'idle' };
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: 'error', message: 'Credenciales inválidas.' };
    }
    // Los redirects de Next.js se lanzan como error y deben propagarse.
    throw error;
  }
}

/** Cierra la sesión y vuelve a /login. */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
