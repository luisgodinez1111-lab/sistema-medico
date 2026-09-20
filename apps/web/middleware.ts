import{NextResponse,type NextRequest}from"next/server";
import{hospitalVerticalsEnabled,isHospitalVerticalPath}from"./lib/feature-flags";
// Auditoría 2026-09-19 (L-10, L-11) — único punto de corte HTTP de las verticales hospitalarias. Con
// ENABLE_HOSPITAL_VERTICALS distinto de "true", sus ~36 rutas responden 404 con la misma forma de error que el resto de la
// API, antes de llegar a ningún handler (no se autentica, no se toca la base de datos, no se revela que existen).
export function middleware(req:NextRequest){
 if(isHospitalVerticalPath(req.nextUrl.pathname)&&!hospitalVerticalsEnabled())
  return NextResponse.json({error:{code:"NOT_FOUND",message:"Not found"}},{status:404,headers:{"cache-control":"no-store"}});
 return NextResponse.next();
}
// El matcher debe ser literal (Next lo analiza en build). Se limita a las 7 verticales para no ejecutar middleware en el
// resto de la API. Debe mantenerse alineado con HOSPITAL_VERTICALS (lo verifica tests/v22/feature-flags.test.ts).
export const config={matcher:[
 "/api/v1/admissions/:path*","/api/v1/dialysis-sessions/:path*","/api/v1/specimens/:path*","/api/v1/surgeries/:path*",
 "/api/v1/transfusions/:path*","/api/v1/triage/:path*","/api/v1/wounds/:path*",
]};
