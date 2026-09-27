import{bmiFromVitals}from"../../../../../../../../packages/anthropometrics/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{resolveDrug}from"../../../../../../../../packages/drug-catalog/src";
import{problemRegistry,activeMedicationDrugCodes,activeAllergySubstances,latestResultValueForAnalyte,patientVitals,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC Y/UI — GET /api/v1/patients/:id/referral-context  (vista Nueva interconsulta, panel derecho)
// Compone la "Información relevante del paciente": alergias, medicamentos actuales (nombre del principio activo),
// problemas activos (código + descripción), últimos laboratorios (HbA1c) y signos vitales (TA/FC/IMC).
// Determinista, sin escritura, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
function latestOf(points:VitalPoint[],type:string):string|null{const p=points.find(x=>x.vitalType===type);return p?p.value:null;}
function latestUnitOf(points:VitalPoint[],type:string):string|undefined{return points.find(x=>x.vitalType===type)?.unit;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"referral:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const[allProblems,medCodes,allergies,hba1c,vitals]=await Promise.all([
   problemRegistry(tctx),
   activeMedicationDrugCodes(tctx,patientId),
   activeAllergySubstances(tctx,patientId),
   latestResultValueForAnalyte(tctx,patientId,"HBA1C"),
   patientVitals(tctx,patientId),
  ]);
  const problems=allProblems.filter(p=>p.patientId===patientId&&(p.status==="ACTIVE"||p.status==="CHRONIC")).map(p=>({code:p.code,description:p.description}));
  const medications=[...new Set(medCodes.map(c=>{const d=resolveDrug(c);return d?d.ingredient:c;}))];
  const points=vitals as VitalPoint[];
  const bp=latestOf(points,"BP"),hr=latestOf(points,"HR"),weight=latestOf(points,"WEIGHT"),height=latestOf(points,"HEIGHT"),heightUnit=latestUnitOf(points,"HEIGHT");
  const imc=(()=>{const b=bmiFromVitals({value:weight},{value:height,unit:heightUnit});return b?String(b.bmi):null;})(); // C-21: IMC único
  return NextResponse.json({
   allergies:[...allergies],
   medications,
   problems,
   labs:{hba1c:hba1c??null},
   vitals:{bp:bp??null,hr:hr??null,imc},
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
