import NextAuth, { type NextAuthResult } from 'next-auth';
import { authConfig } from './auth.config';

/**
 * Proxy de autenticación (Next 16, antes "middleware"; NIVEL 2). Usa SOLO el JWT
 * (edge-safe, sin BD): si no hay sesión, el callback `authorized` redirige a
 * /login. Protege todo salvo assets estáticos, /login y las rutas de Auth.js.
 */
// Anotación explícita: evita TS2742 (tipos inferidos no portables) con pnpm.
export const proxy: NextAuthResult['auth'] = NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
