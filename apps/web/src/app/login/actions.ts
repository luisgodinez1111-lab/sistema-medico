'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';

export interface LoginState {
  status: 'idle' | 'error';
  message?: string;
}

/**
 * Inicia sesión con email + contraseña (Auth.js Credentials). En éxito, signIn
 * lanza un redirect (que debe propagarse). Un fallo de credenciales se traduce a
 * un mensaje genérico — no se revela si el email existe (§NIVEL 2).
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') ?? '').toString().trim();
  const password = (formData.get('password') ?? '').toString();
  if (!email || !password) {
    return { status: 'error', message: 'Ingresa email y contraseña.' };
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
