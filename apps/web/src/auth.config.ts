import type { NextAuthConfig } from 'next-auth';

/**
 * Configuración de Auth.js SIN dependencias de servidor (BD, `server-only`), apta
 * para el middleware que corre en el edge. La verificación real de credenciales
 * (que sí toca la BD) vive en `auth.ts`, en runtime Node.
 *
 * Sesión por JWT: el `uid` del usuario autenticado viaja firmado en el token; el
 * tenant y los permisos se resuelven server-side a partir de ese `uid`
 * (NIVEL 2, ADR-0002), nunca desde el cliente.
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    /** Gate de rutas para el middleware: todo privado salvo /login y /api/auth. */
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPublic = pathname === '/login' || pathname.startsWith('/api/auth');
      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) (token as { uid?: string }).uid = user.id;
      return token;
    },
    session({ session, token }) {
      const uid = (token as { uid?: string }).uid;
      if (uid && session.user) (session.user as { id?: string }).id = uid;
      return session;
    },
  },
};
