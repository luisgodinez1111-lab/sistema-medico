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
function nonceFor():string{const b=new Uint8Array(16);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b));}
export function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 if(!path.startsWith("/api/")){
  const nonce=nonceFor();const csp=contentSecurityPolicy(process.env,nonce);
  const headers=new Headers(req.headers);headers.set("x-nonce",nonce);headers.set("content-security-policy",csp);
  const res=NextResponse.next({request:{headers}});res.headers.set("Content-Security-Policy",csp);
  return res;
 }
 if(isHospitalVerticalPath(path)&&!hospitalVerticalsEnabled())
  return NextResponse.json({error:{code:"NOT_FOUND",message:"Not found"}},{status:404,headers:{"cache-control":"no-store"}});
 if(MUTATING_METHODS.has(req.method)&&!/^\/api\/v1\/sessions\/?$/.test(path)){
  const d=writeLimiter.allow(writeKey(req.headers,req.cookies.get(SESSION_COOKIE)?.value));
  if(!d.allowed)return rateLimitedResponse(d);
 }
 return NextResponse.next();
}
// El matcher debe ser literal (Next lo analiza en build): toda la API v1 (el límite de escrituras aplica a todas las rutas;
// el corte por flag solo actúa sobre las 7 verticales, ver isHospitalVerticalPath).
// Páginas: todo salvo estáticos de Next, imágenes y favicon (reciben nonce + CSP). API v1: flag y límite de tasa.
export const config={matcher:["/api/v1/:path*","/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|json)$).*)"]};
