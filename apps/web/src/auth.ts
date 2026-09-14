import NextAuth, { type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authenticateUser, verifyUserTotp } from '@medical-os/db';
import { authConfig } from './auth.config';
import { getDb } from '@/server/db';

/**
 * Auth.js (NIVEL 2, IdP propio). Credentials (email + contraseña) verificadas
 * contra `app_user` con hash bcrypt; sin proveedor externo. `authorize` corre en
 * runtime Node (toca la BD). El resultado sólo lleva identidad mínima; el tenant
 * y los permisos se cargan aparte a partir del `uid` del JWT.
 */
const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
        totp: { label: 'Código de autenticación', type: 'text' },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        const totp = typeof credentials?.totp === 'string' ? credentials.totp : '';
        const db = getDb();
        const user = await authenticateUser(db, email, password);
        if (!user) return null;
        // Segundo factor: si el usuario tiene MFA, el TOTP debe validar.
        if (user.mfaEnabled && !(await verifyUserTotp(db, email, totp))) return null;
        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
});

// Anotaciones explícitas: evita TS2742 (tipos inferidos no portables) con pnpm.
export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
