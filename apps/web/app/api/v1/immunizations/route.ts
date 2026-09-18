import{NextResponse}from"next/server";
import{handleImmunizationDue}from"../../../../lib/immunization-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{immunizationRegistry}from"../../../../lib/clinical-runtime";
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
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"immunization:write",purpose:"TREATMENT"});
  const rows=await immunizationRegistry(ctx);
  const items=rows.map(r=>({
   immunizationId:r.immunizationId,patientId:r.patientId,patientName:r.patientName,
   vaccine:r.vaccine,dose:r.dose,lot:r.lot,site:r.site,
   status:r.status,statusLabel:STATUS_ES[r.status]??"Pendiente",
   appliedAt:r.appliedAt,registeredBy:r.registeredBy}));
  const total=items.length;
  const applied=items.filter(i=>i.status==="COMPLETE");
  const pending=items.filter(i=>i.status==="PENDING");
  const vaccinatedPatients=new Set(applied.map(i=>i.patientId)).size;
  // pacientes con al menos una dosis pendiente = esquemas potencialmente incompletos
  const patientsWithPending=new Set(pending.map(i=>i.patientId)).size;
  const byVaccine:Record<string,number>={};
  for(const it of applied){const key=it.vaccine||"Otras";byVaccine[key]=(byVaccine[key]??0)+1;}
  return NextResponse.json({
   items,total,
   appliedCount:applied.length,pendingCount:pending.length,
   vaccinatedPatients,incompleteSchemes:patientsWithPending,
   byVaccine,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
