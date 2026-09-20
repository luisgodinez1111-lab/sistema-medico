import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{z}from"zod";
import{resolveDrug,monitoringFor}from"../../../../../../../../packages/drug-catalog/src";
import{evaluatePrescriptionSafety,ageInYears,type BarrierStatus}from"../../../../../../../../packages/prescription-safety/src";
import{activeAllergySubstances,activeMedicationDrugCodes,activeProblemCodes,patientEgfr,patientDemographics,latestVitalsByType}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,parseJson}from"../../../../../../lib/http-command";
// EPIC CG — POST /api/v1/patients/:id/prescription-check  (panel 3: "Prescripción segura y verificación")
// DRY-RUN de las barreras de seguridad SIN escribir: alergia, interacción, duplicado terapéutico,
// contraindicación por dx, dosis-techo, y ajuste renal por eGFR + monitorización. Núcleo determinista.
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Estados que ve la UI. NOT_EVALUATED / NOT_COVERED / NA NUNCA se pintan en verde (auditoría 2026-09-19, C-14).
type Status="OK"|"WARN"|"BLOCK"|"NOT_EVALUATED"|"NOT_COVERED"|"NA";
const UI_STATUS:Record<BarrierStatus,Status>={PASSED:"OK",CAUTION:"WARN",BLOCKED:"BLOCK",NOT_EVALUATED:"NOT_EVALUATED",NOT_COVERED:"NOT_COVERED",NOT_APPLICABLE:"NA"};
// Normaliza a la clave del catálogo: NFD descompone acentos; se elimina todo lo que no sea [a-z0-9 -].
const norm=(s:string)=>s.normalize("NFD").replace(/[^a-z0-9 -]/gi,"").toLowerCase().trim();
const Body=z.object({drug:z.string().trim().min(1).max(160),dose:z.string().trim().max(80).default(""),route:z.string().trim().max(40).default(""),frequency:z.string().trim().max(80).default("")});

export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const body=await parseJson(req,Body);
  const code=norm(body.drug);
  const[substances,activeMeds,conditions,egfrRaw,vitals,demo]=await Promise.all([
   activeAllergySubstances(tctx,patientId),activeMedicationDrugCodes(tctx,patientId),activeProblemCodes(tctx,patientId),
   patientEgfr(tctx,patientId),latestVitalsByType(tctx,patientId),patientDemographics(tctx,patientId)]);
  const egfr=typeof egfrRaw==="number"&&Number.isFinite(egfrRaw)?egfrRaw:undefined;
  const wRaw=vitals["WEIGHT"];const wNum=wRaw===undefined?NaN:Number(String(wRaw).trim());
  // El MISMO evaluador que usa la ruta de escritura (PRESCRIBE): la verificación previa y el bloqueo real no divergen.
  const safety=evaluatePrescriptionSafety({drugCode:code,dose:body.dose,route:body.route,frequency:body.frequency,
   allergySubstances:substances,activeDrugCodes:activeMeds,activeConditionCodes:conditions,egfr,
   weightKg:Number.isFinite(wNum)?wNum:undefined,ageYears:demo?.birthDate?ageInYears(demo.birthDate,new Date().toISOString()):undefined});
  const checks=safety.barriers.map(b=>({id:b.id,label:b.label,status:UI_STATUS[b.status],detail:b.detail}));
  const verdict:"OK"|"WARN"|"BLOCK"=safety.verdict==="BLOCK"?"BLOCK":safety.verdict==="REVIEW"?"WARN":"OK";
  const resolved=resolveDrug(code)??null;
  const monitoring=resolved?monitoringFor(code).map(m=>({test:m.test,note:m.note,dueInDays:m.dueInDays})):[];
  return NextResponse.json({patientId,drug:{input:body.drug,resolved},egfr:egfr??null,checks,monitoring,
   indications:instr(body.dose,body.route,body.frequency),verdict,
   requiresAcknowledgement:safety.requiresAcknowledgement,notEvaluated:safety.notEvaluated,notCovered:safety.notCovered},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
function instr(dose:string,route:string,frequency:string):string{
 const parts=[dose&&`Tomar ${dose}`,route&&`por vía ${route.toLowerCase()}`,frequency&&`${frequency}`].filter(Boolean);
 return parts.length?parts.join(" ")+".":"";
}
