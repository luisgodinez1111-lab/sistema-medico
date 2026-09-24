import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{forecast,forecastSummary}from"../../../../../../../../packages/immunization-schedule/src";
import{patientBirthDate,administeredVaccines}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BK — GET /api/v1/patients/:id/immunization-forecast (cartilla: DUE/OVERDUE/UPCOMING por edad)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const birthDate=await patientBirthDate(tctx,patientId);
  if(!birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (birthDate unavailable)");
  const administered=await administeredVaccines(tctx,patientId);
  const asOf=new Date().toISOString();
  // R03-30: el envoltorio distingue «fecha de nacimiento no interpretable» de «sin pendientes» —antes ambas cosas eran
  // un arreglo vacío— y devuelve las dosis APLICADAS que no cuentan para la serie por edad o intervalo insuficientes.
  const f=forecast(birthDate,administered,asOf);
  if(!f.ok)return NextResponse.json({patientId,computable:false,reasonCode:f.reasonCode,reason:f.detail},{status:200});
  return NextResponse.json({patientId,computable:true,ageMonths:f.ageMonths,summary:forecastSummary(f.doses),forecast:f.doses,
   invalidatedDoses:f.invalidated,
   ...(f.invalidated.length?{invalidatedNote:"Hay dosis registradas que NO cuentan para la serie (edad o intervalo mínimos no cumplidos): deben repetirse. El registro se conserva; lo que no se conserva es el crédito en el esquema."}:{}),
   algorithm:{id:"IMMUNIZATION-FORECAST",version:"3",authority:"Cartilla Nacional de Salud (SSA) y esquemas OMS; reglas de edad e intervalo mínimos según ACIP/CDC. PENDIENTE de validación clínica."}},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
