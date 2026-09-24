import{NextResponse,type NextRequest}from"next/server";
import{hospitalVerticalsEnabled,isHospitalVerticalPath}from"./lib/feature-flags";
import{writeLimiter,writeKey,MUTATING_METHODS,rateLimitedResponse}from"./lib/rate-limit";
import{SESSION_COOKIE}from"./lib/session-cookie-name";
import{contentSecurityPolicy}from"./lib/csp.mjs";
// Borde HTTP de la API (se ejecuta antes de cualquier handler; no autentica ni toca la base de datos).
//  1) Auditoría L-10/L-11: con ENABLE_HOSPITAL_VERTICALS distinto de "true", las ~36 rutas de las verticales hospitalarias
//     responden 404 con la misma forma de error que el resto de la API (no se revela que existen).
//  2) Auditoría S-03: límite de tasa de las ESCRITURAS (POST/PUT/PATCH/DELETE) por sesión —o por IP si no hay sesión—.
//     El login tiene su propio límite por IP dentro de su handler (apps/web/lib/session-issuance.ts).
// Auditoría S-04: nonce por petición para las páginas HTML. El middleware lo genera, lo pone en la cabecera de la PETICIÓN
// (Next lo lee de `content-security-policy` y marca sus scripts en línea con él) y fija la CSP definitiva en la respuesta.
// Páginas que exigen cookie de sesión. `/` y `/login` son públicas; los estáticos no pasan por aquí (ver el matcher).
const PROTECTED_PAGE=/^\/(workspace)(\/|$)/;
// Auditoría 2026-09-19, anexo R04 (F09 y F10) — CORRELACIÓN Y VERSIÓN EN LA RESPUESTA.
//
// F09: «ningún encabezado X-Request-Id devuelto al cliente (requestId solo interno)». El identificador ya existía y se
// usaba en los logs y en el recibo de auditoría, pero el cliente no lo recibía: cuando un médico reporta «no me dejó
// firmar», no había forma de atar su pantalla a la traza del servidor. Ahora viaja de vuelta, y si el cliente lo manda
// se RESPETA el suyo, que es lo que permite correlacionar una cadena de llamadas.
// F10: «ningún endpoint expone la versión de API en la respuesta (solo en el path /v1/)». El path se puede reescribir en
// un proxy; la cabecera viene del servidor que respondió de verdad.
const API_VERSION="v1";
function conCorrelacion<T extends Response>(res:T,requestId:string):T{
 res.headers.set("X-Request-Id",requestId);
 res.headers.set("X-Medos-Api-Version",API_VERSION);
 return res;
}
function nonceFor():string{const b=new Uint8Array(16);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b));}
export function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 if(!path.startsWith("/api/")){
  // Auditoría R01-031/R01-032: la protección de /workspace era un `useEffect` en el cliente que leía sessionStorage; el
  // HTML se servía igual y el «guard duro» del comentario no existía. Ahora el borde exige la presencia de la cookie de
  // sesión para las páginas clínicas y redirige a /login. Es un control de PRESENCIA, no de validez: la autoridad sigue
  // decidiéndose en el servidor (la API verifica la firma HMAC y la revocación en cada petición). Sirve para no entregar
  // el cockpit a quien no trae sesión y para que la redirección no dependa de que el JavaScript del cliente llegue a correr.
  if(PROTECTED_PAGE.test(path)&&!req.cookies.get(SESSION_COOKIE)?.value){
   const to=req.nextUrl.clone();to.pathname="/login";to.search=`?next=${encodeURIComponent(path)}`;
   return NextResponse.redirect(to);
  }
  const nonce=nonceFor();const csp=contentSecurityPolicy(process.env,nonce);
  const headers=new Headers(req.headers);headers.set("x-nonce",nonce);headers.set("content-security-policy",csp);
  const res=NextResponse.next({request:{headers}});res.headers.set("Content-Security-Policy",csp);
  return res;
 }
 // El identificador de correlación: se respeta el del cliente si lo manda, y si no se genera uno.
 const requestId=req.headers.get("x-request-id")??crypto.randomUUID();
 if(isHospitalVerticalPath(path)&&!hospitalVerticalsEnabled())
  return conCorrelacion(NextResponse.json({error:{code:"NOT_FOUND",message:"Not found"}},{status:404,headers:{"cache-control":"no-store"}}),requestId);
 if(MUTATING_METHODS.has(req.method)&&!/^\/api\/v1\/sessions\/?$/.test(path)){
  const d=writeLimiter.allow(writeKey(req.headers,req.cookies.get(SESSION_COOKIE)?.value));
  if(!d.allowed)return conCorrelacion(rateLimitedResponse(d),requestId);
 }
 // El handler lee el mismo identificador de la cabecera de la PETICIÓN (http-command.ts lo hace ya), así que el que
 // devuelve la respuesta es exactamente el que quedó en los logs y en el recibo de auditoría: no son dos números.
 const headers=new Headers(req.headers);headers.set("x-request-id",requestId);
 return conCorrelacion(NextResponse.next({request:{headers}}),requestId);
}
// El matcher debe ser literal (Next lo analiza en build): toda la API v1 (el límite de escrituras aplica a todas las rutas;
// el corte por flag solo actúa sobre las 7 verticales, ver isHospitalVerticalPath).
// Páginas: todo salvo estáticos de Next, imágenes y favicon (reciben nonce + CSP). API v1: flag y límite de tasa.
export const config={matcher:["/api/v1/:path*","/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|json)$).*)"]};
