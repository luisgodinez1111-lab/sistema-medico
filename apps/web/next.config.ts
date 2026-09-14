import type { NextConfig } from 'next';

/**
 * Content Security Policy (NIVEL 15, §25). Bloqueo por defecto y allowlist mínima:
 * - `default-src 'self'`: nada externo salvo lo declarado.
 * - `connect-src` incluye R2 (`*.r2.cloudflarestorage.com`) porque el navegador
 *   sube los documentos con un PUT prefirmado directo al bucket.
 * - `frame-ancestors 'none'` + `object-src 'none'` + `base-uri 'self'` +
 *   `form-action 'self'`: mitigan clickjacking, inyección de <base>/objetos y
 *   exfiltración por formularios.
 * - `style-src`/`script-src` mantienen `'unsafe-inline'` por ahora (Next inyecta
 *   scripts de bootstrap y la app usa estilos inline); el endurecimiento a
 *   nonce/hash queda como siguiente paso de NIVEL 15.
 * - `upgrade-insecure-requests`: fuerza HTTPS en subrecursos.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.r2.cloudflarestorage.com",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // Fuerza HTTPS (HSTS) durante 2 años, incl. subdominios; apto para preload.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // frame-ancestors (CSP) es la defensa moderna; X-Frame-Options cubre navegadores viejos.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Los paquetes del workspace exportan TS/TSX fuente: Next debe transpilarlos.
  transpilePackages: ['@medical-os/design-system', '@medical-os/shared', '@medical-os/db'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
