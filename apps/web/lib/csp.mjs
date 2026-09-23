// Política de contenido (CSP) — módulo SIN dependencias de Node: lo importan next.config.mjs (build) y el middleware
// (runtime Edge). Auditoría S-04.
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
// Auditoría 2026-09-19 (S-04) — `nonce`: cuando el middleware genera un nonce por petición (páginas HTML), `script-src`
// pasa a `'nonce-…' 'strict-dynamic'`: NINGÚN script en línea sin nonce se ejecuta (Next marca los suyos con el nonce que
// lee de la cabecera de la petición). Sin nonce (respuestas de la API, que no son HTML) se conserva la política estática.
// `style-src` sigue con 'unsafe-inline': la UI usa atributos `style` (SSR) y un nonce no los cubre; queda declarado.
export function contentSecurityPolicy(env=process.env,nonce=""){
 const idp=auth0Origin(env);const dev=env.NODE_ENV!=="production";
 const scriptSrc=nonce?`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":""}`:`script-src 'self' 'unsafe-inline'${dev?" 'unsafe-eval'":""}`;
 return[
  "default-src 'self'",
  scriptSrc,
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
