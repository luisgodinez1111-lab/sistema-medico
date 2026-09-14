import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad ESTÁTICAS (NIVEL 15, §25). La Content-Security-Policy NO
 * está aquí: se emite por-request en `proxy.ts` con un nonce único (necesario para
 * endurecer `script-src` sin `'unsafe-inline'`). Éstas no dependen del request.
 */
const SECURITY_HEADERS = [
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
