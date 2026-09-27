import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{forecastImmunizations,forecastSummary,ageInMonths}from"../../../../../../../../packages/immunization-schedule/src";
import{patientBirthDate,administeredVaccines}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC BK — GET /api/v1/patients/:id/immunization-forecast (cartilla: DUE/OVERDUE/UPCOMING por edad)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const birthDate=await patientBirthDate(tctx,patientId);
  if(!birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (birthDate unavailable)");
  const administered=await administeredVaccines(tctx,patientId);
  const asOf=new Date().toISOString();
  const forecast=forecastImmunizations(birthDate,administered,asOf);
  return NextResponse.json({patientId,ageMonths:ageInMonths(birthDate,asOf),summary:forecastSummary(forecast),forecast},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
