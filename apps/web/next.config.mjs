import{fileURLToPath}from"node:url";
/** @type {import('next').NextConfig} */
// EPIC B — `postgres` (postgres.js) es una dependencia nativa de servidor: se externaliza
// para que Next no intente empaquetarla en el bundle de la Function.
//
// Auditoría 2026-09-19 (S-04) — CABECERAS DE SEGURIDAD. Antes esta configuración solo declaraba
// `serverExternalPackages`: ninguna respuesta llevaba CSP, HSTS, anti-clickjacking ni política de referente, y 0 de ~130
// rutas de la API enviaban `Cache-Control` (incluida la exportación del expediente completo). Se fijan aquí, de forma
// declarativa, para TODA respuesta: no dependen de que cada handler se acuerde.

// Origen del IdP (Auth0): el SDK del navegador llama a su endpoint de token (connect-src) y renueva la sesión con un
// iframe oculto (frame-src). Es el ÚNICO origen externo permitido. Sin la variable, no se abre ninguno.
export function auth0Origin(env=process.env){
 const d=(env.NEXT_PUBLIC_AUTH0_DOMAIN??"").trim().replace(/^https?:\/\//,"").replace(/\/+$/,"");
 return /^[a-z0-9.-]+$/i.test(d)?`https://${d}`:"";
}
// Política de contenido. `'unsafe-inline'` en script/style es el mínimo que Next exige sin infraestructura de nonces (su
// arranque usa scripts en línea y la UI usa atributos `style`); aun así la política impide cargar scripts de terceros,
// exfiltrar datos a otros orígenes (connect-src), incrustar la app en otra página (frame-ancestors), secuestrar
// formularios (form-action) o la URL base (base-uri), y cargar plugins (object-src). En desarrollo React Refresh necesita eval.
export function contentSecurityPolicy(env=process.env){
 const idp=auth0Origin(env);const dev=env.NODE_ENV!=="production";
 return[
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev?" 'unsafe-eval'":""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",          // firma/sello del médico y vistas previas se sirven como blob: tras descarga autorizada
  "font-src 'self' data:",
  `connect-src 'self'${idp?` ${idp}`:""}${dev?" ws: wss:":""}`,
  `frame-src ${idp||"'none'"}`,
  "worker-src 'self' blob:",             // el SDK de Auth0 usa un Web Worker creado desde blob:
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev?[]:["upgrade-insecure-requests"]),
 ].join("; ");
}
export function securityHeaders(env=process.env){
 return[
  {key:"Content-Security-Policy",value:contentSecurityPolicy(env)},
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
  return[
   {source:"/:path*",headers:securityHeaders()},
   {source:"/api/:path*",headers:API_NO_STORE},
  ];
 },
};
export default nextConfig;
