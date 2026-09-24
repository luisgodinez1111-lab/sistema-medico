import{bmiFromVitals}from"../../../../../../../../packages/anthropometrics/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{resolveDrug}from"../../../../../../../../packages/drug-catalog/src";
import{problemRegistry,activeMedicationDrugCodes,activeAllergySubstances,latestAnalyteReading,patientVitals,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
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
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"referral:read",purpose:"TREATMENT"});
  const[problems0,medCodes,allergies,hba1c,vitals]=await Promise.all([
   problemRegistry(tctx,{patientId}), // R06-20: el filtro por paciente viaja en el SQL (antes se leía toda la clínica)
   activeMedicationDrugCodes(tctx,patientId),
   activeAllergySubstances(tctx,patientId),
   latestAnalyteReading(tctx,patientId,"HBA1C"),
   patientVitals(tctx,patientId),
  ]);
  const problems=problems0.items.filter(p=>p.status==="ACTIVE"||p.status==="CHRONIC").map(p=>({code:p.code,description:p.description}));
  const medications=[...new Set(medCodes.map(c=>{const d=resolveDrug(c);return d?d.ingredient:c;}))];
  const points=vitals as VitalPoint[];
  const bp=latestOf(points,"BP"),hr=latestOf(points,"HR"),weight=latestOf(points,"WEIGHT"),height=latestOf(points,"HEIGHT"),heightUnit=latestUnitOf(points,"HEIGHT");
  const imc=(()=>{const b=bmiFromVitals({value:weight},{value:height,unit:heightUnit});return b?String(b.bmi):null;})(); // C-21: IMC único
  return NextResponse.json({
   allergies:[...allergies],
   medications,
   problems,
   // R03-10: la HbA1c del contexto de referencia viaja con unidad y fecha. Un «8.2» sin fecha en una hoja de
   // referencia obliga al especialista a pedirla otra vez, o peor, a tratarla como actual.
   labs:{hba1c:hba1c?{value:hba1c.value,unit:hba1c.canonicalUnit??hba1c.unit,occurredAt:hba1c.occurredAt,ageDays:Math.floor((Date.now()-Date.parse(hba1c.occurredAt))/86_400_000)}:null},
   vitals:{bp:bp??null,hr:hr??null,imc},
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
