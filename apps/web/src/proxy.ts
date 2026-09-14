import NextAuth from 'next-auth';
import { NextResponse, type NextMiddleware } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

/**
 * Content Security Policy con NONCE por request (NIVEL 15, §25). Se genera aquí
 * (no en next.config) porque el nonce debe ser único por respuesta.
 *
 * - `script-src` ya NO usa `'unsafe-inline'`: sólo scripts con este nonce y los
 *   que ellos carguen (`'strict-dynamic'`). Next inyecta el nonce en sus <script>
 *   al leer esta CSP de las cabeceras de la request. Cierra el vector de XSS por
 *   inyección de <script>.
 * - `style-src` conserva `'unsafe-inline'`: la app usa atributos `style={{}}` y
 *   CSP NO admite nonce/hash en atributos (sólo en elementos <style>); endurecerlo
 *   exigiría eliminar todos los estilos inline (refactor mayor, menor severidad).
 * - `connect-src` incluye R2 para la subida prefirmada directa al bucket.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "connect-src 'self' https://*.r2.cloudflarestorage.com",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Nonce aleatorio apto para el edge (Web Crypto, sin Buffer/Node). */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Proxy de autenticación + CSP (Next 16, antes "middleware"; NIVEL 2/15). Gatea
 * con SOLO el JWT (edge-safe, sin BD): todo privado salvo /login y /api/auth. En
 * cada respuesta añade la CSP con nonce (script-src endurecido).
 */
// `auth(fn)` se tipa como AppRouteHandlerFn (overload de NextAuth) pero en runtime
// funciona como middleware; el único desajuste es el `ctx`. Cast explícito al tipo
// correcto de proxy (evita además el TS2742 de tipos no portables con pnpm).
export const proxy = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth?.user);
  const isPublic =
    nextUrl.pathname === '/login' ||
    nextUrl.pathname.startsWith('/api/auth') ||
    // Opciones de login con passkey: necesarias ANTES de autenticar (§NIVEL 2/15).
    nextUrl.pathname.startsWith('/api/webauthn/authenticate');

  if (!isPublic && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl.origin));
  }

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Next detecta el nonce leyendo la CSP de las cabeceras de la REQUEST; además
  // exponemos `x-nonce` por si un Server Component necesita firmar un <script>.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('content-security-policy', csp);
  return res;
}) as unknown as NextMiddleware;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
