import NextAuth, { type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {
  authenticateUser,
  verifyUserTotp,
  resolveRp,
  verifyAuthentication,
  findCredentialByCredentialId,
  updateCredentialCounter,
  getActiveUserById,
  type AuthenticationResponseJSON,
} from '@medical-os/db';
import { authConfig } from './auth.config';
import { getDb } from '@/server/db';

/** Lee una cookie por nombre de una cabecera Cookie cruda. */
function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

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
    // Login SIN contraseña con passkey (§NIVEL 2/15). El cliente obtiene opciones de
    // /api/webauthn/authenticate/options (que fija la cookie del challenge), ejecuta
    // la ceremonia y envía la aserción aquí. El usuario se identifica por la
    // credencial; se verifica la firma contra la llave pública guardada.
    Credentials({
      id: 'passkey',
      name: 'Passkey',
      credentials: { assertion: { label: 'Assertion', type: 'text' } },
      authorize: async (credentials, request) => {
        const raw = typeof credentials?.assertion === 'string' ? credentials.assertion : '';
        if (!raw) return null;
        let assertion: AuthenticationResponseJSON;
        try {
          assertion = JSON.parse(raw) as AuthenticationResponseJSON;
        } catch {
          return null;
        }
        const challenge = readCookie(request.headers.get('cookie'), 'wa_chal');
        if (!challenge) return null;

        const db = getDb();
        const stored = await findCredentialByCredentialId(db, assertion.id);
        if (!stored) return null;

        const host =
          request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost';
        const rp = resolveRp(host);

        let result: { verified: boolean; newCounter: number };
        try {
          result = await verifyAuthentication({
            rp,
            response: assertion,
            expectedChallenge: challenge,
            credential: {
              credentialId: stored.credentialId,
              publicKey: stored.publicKey,
              counter: stored.counter,
              transports: stored.transports,
            },
          });
        } catch {
          return null;
        }
        if (!result.verified) return null;

        await updateCredentialCounter(db, stored.id, result.newCounter);
        const u = await getActiveUserById(db, stored.userId);
        if (!u) return null;
        return { id: u.id, email: u.email, name: u.displayName };
      },
    }),
  ],
});

// Anotaciones explícitas: evita TS2742 (tipos inferidos no portables) con pnpm.
export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
