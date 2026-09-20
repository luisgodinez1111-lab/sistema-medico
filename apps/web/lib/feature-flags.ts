// Auditoría 2026-09-19 (L-10, L-11) — VERTICALES HOSPITALARIAS APAGADAS POR DEFECTO.
//
// Transfusión sin grupo ABO/Rh ("prueba cruzada" sin nada que cruzar), "time-out" quirúrgico sin lista de verificación,
// diálisis, triage, admisión, cadena de custodia de muestras y heridas son flujos de ALTO riesgo que hoy solo registran
// transiciones vacías: dan una garantía que no existe. Decisión del dueño del producto (2026-09-20): el código permanece en
// el repo, pero NO se sirve salvo que se encienda explícitamente con ENABLE_HOSPITAL_VERTICALS="true".
//
// Con el flag apagado: sus rutas responden 404 como si no existieran (apps/web/middleware.ts) y la UI no pinta sus paneles
// (GET /api/v1/features). Una sola fuente de verdad: esta variable del SERVIDOR (no hay gemela NEXT_PUBLIC_ que pueda derivar).
//
// Este módulo NO importa nada de Node ni de la base de datos: lo usa el middleware.
export const HOSPITAL_VERTICALS=["admissions","dialysis-sessions","specimens","surgeries","transfusions","triage","wounds"]as const;
export type HospitalVertical=typeof HOSPITAL_VERTICALS[number];
// Solo el literal "true" enciende: cualquier otro valor ("1", "TRUE", "yes", vacío, ausente) es APAGADO (fail-closed).
export function hospitalVerticalsEnabled(env:Readonly<Record<string,string|undefined>>=process.env):boolean{
 return env["ENABLE_HOSPITAL_VERTICALS"]==="true";
}
// ¿La ruta pertenece a una vertical hospitalaria? Compara el PRIMER segmento tras /api/v1/ de forma exacta, sin distinguir
// mayúsculas (Next enruta sin distinguirlas en algunos despliegues) y tolerando barras repetidas o finales.
export function isHospitalVerticalPath(pathname:string):boolean{
 const m=/^\/+api\/+v1\/+([^/]+)(?:\/|$)/i.exec(pathname);
 if(!m)return false;
 let seg=m[1]!;try{seg=decodeURIComponent(seg);}catch{/* segmento mal codificado: se compara tal cual (no coincidirá) */}
 return(HOSPITAL_VERTICALS as readonly string[]).includes(seg.toLowerCase());
}
// Capacidades que el cliente necesita conocer para decidir qué pinta. Sin PHI ni secretos.
export type ClientFeatures=Readonly<{hospitalVerticals:boolean}>;
export function clientFeatures(env:Readonly<Record<string,string|undefined>>=process.env):ClientFeatures{
 return{hospitalVerticals:hospitalVerticalsEnabled(env)};
}
