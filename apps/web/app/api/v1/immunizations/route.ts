import{NextResponse}from"next/server";
import{handleImmunizationDue}from"../../../../lib/immunization-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{immunizationRegistry,registrySummary,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleImmunizationDue(req);}

// EPIC V/UI — GET /api/v1/immunizations -> registro de vacunación de toda la clínica (vista Vacunas).
// Cada dosis con paciente, vacuna, dosis, lote, estado y fecha, MÁS conteos (aplicadas/pendientes/pacientes
// vacunados) y cobertura por vacuna (para el donut). RLS-scoped.
const STATUS_ES:Record<string,string>={COMPLETE:"Completa",PENDING:"Pendiente",REFUSED:"Rechazada",ADVERSE:"Evento adverso"};
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"immunization:read",purpose:"TREATMENT"});
  // R06-20: la lista va ACOTADA (página con cursor) y los indicadores se calculan EN LA BASE. Antes se traía el tenant
  // entero y se contaba en Node, así que acotar la página sin mover los recuentos habría falseado todos los KPI.
  const url=new URL(req.url);
  const page=await immunizationRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>({
   immunizationId:r.immunizationId,patientId:r.patientId,patientName:r.patientName,
   vaccine:r.vaccine,dose:r.dose,lot:r.lot,site:r.site,
   status:r.status,statusLabel:STATUS_ES[r.status]??"Pendiente",
   appliedAt:r.appliedAt,registeredBy:r.registeredBy}));
  const resumen=await registrySummary(ctx,{aggregateType:"Immunization",baseKind:"DUE",groupField:"vaccineCode"});
  const total=resumen.total;
  const appliedCount=resumen.byStatus["ADMINISTERED"]??0,pendingCount=resumen.byStatus["DUE"]??0;
  // `byVaccine` cuenta solo las APLICADAS: el cruce estado × vacuna viene del mismo agregado, no de la página.
  const byVaccine:Record<string,number>={};
  for(const[vac,n]of Object.entries(resumen.byGroupByStatus["ADMINISTERED"]??{}))byVaccine[vac||"Otras"]=Number(n);
  return NextResponse.json({
   items,nextCursor:page.nextCursor,total,
   appliedCount,pendingCount,
   // Pacientes DISTINTOS por estado, contados con count(distinct) en la base (uno puede tener varias dosis).
   vaccinatedPatients:resumen.patientsByStatus["ADMINISTERED"]??0,
   incompleteSchemes:resumen.patientsByStatus["DUE"]??0,
   byVaccine,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
