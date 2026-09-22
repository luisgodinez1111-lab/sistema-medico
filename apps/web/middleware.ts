import{NextResponse,type NextRequest}from"next/server";
import{hospitalVerticalsEnabled,isHospitalVerticalPath}from"./lib/feature-flags";
import{writeLimiter,writeKey,MUTATING_METHODS,rateLimitedResponse}from"./lib/rate-limit";
import{SESSION_COOKIE}from"./lib/session-cookie-name";
// Borde HTTP de la API (se ejecuta antes de cualquier handler; no autentica ni toca la base de datos).
//  1) Auditoría L-10/L-11: con ENABLE_HOSPITAL_VERTICALS distinto de "true", las ~36 rutas de las verticales hospitalarias
//     responden 404 con la misma forma de error que el resto de la API (no se revela que existen).
//  2) Auditoría S-03: límite de tasa de las ESCRITURAS (POST/PUT/PATCH/DELETE) por sesión —o por IP si no hay sesión—.
//     El login tiene su propio límite por IP dentro de su handler (apps/web/lib/session-issuance.ts).
export function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
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
export const config={matcher:["/api/v1/:path*"]};
