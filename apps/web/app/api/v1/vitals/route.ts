import{NextResponse}from"next/server";
import{handleVitalRecord}from"../../../../lib/vital-lifecycle";
import{vitalsRegistry,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleVitalRecord(req);}

// EPIC E/UI (Lote E) — GET /api/v1/vitals -> registro POBLACIONAL de signos vitales de toda la clínica (vista
// Signos vitales › «Toda la clínica»). Cada lectura VIGENTE con paciente/tipo/valor/estado/crítico, MÁS conteos
// (críticos/anormales/pacientes) calculados EN LA BASE sobre el valor vigente. Lista acotada por cursor. RLS-scoped.
const VITAL_TYPE_ES:Record<string,string>={BP:"Presión arterial",HR:"Frecuencia cardíaca",TEMP:"Temperatura",SPO2:"Saturación O₂",WEIGHT:"Peso",HEIGHT:"Talla",RESP:"Frecuencia respiratoria"};
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"vital:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  const url=new URL(req.url);
  const page=await vitalsRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>({...r,vitalTypeLabel:VITAL_TYPE_ES[r.vitalType]??r.vitalType}));
  return NextResponse.json({items,nextCursor:page.nextCursor,total:page.total,criticalCount:page.criticalCount,abnormalCount:page.abnormalCount,patientsCount:page.patientsCount},{status:200});
 });
}
