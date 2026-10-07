import{NextResponse}from"next/server";
import{handleCarePlanPropose}from"../../../../lib/careplan-lifecycle";
import{carePlanRegistry,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleCarePlanPropose(req);}

// EPIC E/UI (Lote E) — GET /api/v1/care-plans -> registro POBLACIONAL de planes de cuidado de toda la clínica (vista
// Plan de cuidado › «Toda la clínica»). Cada plan con paciente/categoría/objetivo/estado, MÁS conteos (activos/en
// pausa/logrados/pacientes) calculados en la base. Lista acotada por cursor. RLS-scoped.
const CAT_ES:Record<string,string>={DIABETES:"Diabetes",HYPERTENSION:"Hipertensión",OBESITY:"Obesidad",CARDIOVASCULAR:"Cardiovascular",MENTAL_HEALTH:"Salud mental",PRENATAL:"Prenatal",OTHER:"Otro"};
const STATUS_ES:Record<string,string>={PROPOSED:"Propuesto",ACTIVE:"Activo",ON_HOLD:"En pausa",ACHIEVED:"Logrado",CANCELLED:"Cancelado"};
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"careplan:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  const url=new URL(req.url);
  const page=await carePlanRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>({...r,categoryLabel:CAT_ES[r.category]??r.category,statusLabel:STATUS_ES[r.status]??r.status}));
  return NextResponse.json({items,nextCursor:page.nextCursor,total:page.total,activeCount:page.activeCount,onHoldCount:page.onHoldCount,achievedCount:page.achievedCount,patientsCount:page.patientsCount},{status:200});
 });
}
