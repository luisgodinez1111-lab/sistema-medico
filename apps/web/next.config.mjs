import{fileURLToPath}from"node:url";
/** @type {import('next').NextConfig} */
// EPIC B — `postgres` (postgres.js) es una dependencia nativa de servidor: se externaliza
// para que Next no intente empaquetarla en el bundle de la Function.
//
// Auditoría 2026-09-19 (S-04) — CABECERAS DE SEGURIDAD. Antes esta configuración solo declaraba
// `serverExternalPackages`: ninguna respuesta llevaba CSP, HSTS, anti-clickjacking ni política de referente, y 0 de ~130
// rutas de la API enviaban `Cache-Control` (incluida la exportación del expediente completo). Se fijan aquí, de forma
// declarativa, para TODA respuesta: no dependen de que cada handler se acuerde.

import{auth0Origin,contentSecurityPolicy}from"./lib/csp.mjs";
export{auth0Origin,contentSecurityPolicy};
export function securityHeaders(env=process.env,nonce=""){
 return[
  {key:"Content-Security-Policy",value:contentSecurityPolicy(env,nonce)},
  {key:"Strict-Transport-Security",value:"max-age=63072000; includeSubDomains"},
  {key:"X-Frame-Options",value:"DENY"},                       // respaldo de frame-ancestors para navegadores antiguos
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"no-referrer"},                // las rutas llevan identificadores de paciente: nunca salen en un Referer
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"},
  {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
  {key:"Cross-Origin-Resource-Policy",value:"same-origin"},
  {key:"X-DNS-Prefetch-Control",value:"off"},
 ];
}
// Toda respuesta de la API puede contener PHI: ni el navegador ni ningún intermediario deben guardarla.
export const API_NO_STORE=[{key:"Cache-Control",value:"no-store"},{key:"Pragma",value:"no-cache"}];

const nextConfig={
 serverExternalPackages:["postgres"],
 poweredByHeader:false, // no anunciar el framework
 // Auditoría P-15: salida `standalone` para la imagen Docker self-hosted (server.js + node_modules mínimos). Vercel la
 // ignora sin efecto. El repo es un monorepo: la raíz de trazado es la raíz del repositorio (los paquetes se importan por ruta).
 output:"standalone",
 outputFileTracingRoot:fileURLToPath(new URL("../..",import.meta.url)),
 async headers(){
  // Las páginas HTML reciben su CSP con nonce desde el middleware (S-04); aquí queda la política estática para la API y
  // los estáticos, y el resto de cabeceras para todo.
  return[
   {source:"/:path*",headers:securityHeaders().filter(h=>h.key!=="Content-Security-Policy")},
   {source:"/api/:path*",headers:[...API_NO_STORE,{key:"Content-Security-Policy",value:contentSecurityPolicy()}]},
   {source:"/_next/:path*",headers:[{key:"Content-Security-Policy",value:contentSecurityPolicy()}]},
  ];
 },
};
export default nextConfig;
