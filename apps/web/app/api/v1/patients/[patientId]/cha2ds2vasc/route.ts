import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{cha2ds2vasc}from"../../../../../../../../packages/stroke-risk/src";
import{patientDemographics,activeProblemCodes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{inValueSet,ICD10_VALUE_SETS,ICD10_VALUE_SET_VERSION,type Icd10ValueSet}from"../../../../../../../../packages/terminology/src";
// EPIC BQ — GET /api/v1/patients/:id/cha2ds2vasc (riesgo de ictus en FA -> indicación de anticoagulación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(birthDate:string):number{
 const b=new Date(birthDate),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
// R03-17: el emparejado de códigos vive en `packages/terminology/value-sets` (normalizado, versionado y con los códigos
// que faltaban: Z86.7, I70, I11–I15, E13). Antes cada ruta llevaba su propio `startsWith` sobre el texto crudo.
const en=(codes:string[],set:Icd10ValueSet)=>inValueSet(codes,set);
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const codes=await activeProblemCodes(tctx,patientId);
  const r=cha2ds2vasc({
   ageYears:ageYears(demo.birthDate),
   female:demo.sexAtBirth==="FEMALE",
   chf:en(codes,ICD10_VALUE_SETS.heartFailure),
   hypertension:en(codes,ICD10_VALUE_SETS.hypertension),
   diabetes:en(codes,ICD10_VALUE_SETS.diabetes),
   strokeHistory:en(codes,ICD10_VALUE_SETS.strokeOrTia),
   vascularDisease:en(codes,ICD10_VALUE_SETS.vascularDisease),
  });
  if(!r)throw new ClinicalError("VALIDATION_ERROR","No computable");
  // La FA no valvular es el contexto de aplicación del score.
  const atrialFibrillation=en(codes,ICD10_VALUE_SETS.atrialFibrillation);
  // Auditoría R03-04: cuando el score NO es aplicable (sin FA activa registrada) NO se emite recomendación. Antes se
  // devolvía «Anticoagulación oral recomendada» junto a `applicable:false`, y una recomendación terapéutica junto a un
  // booleano se lee como recomendación. Sin el contexto que valida la escala, el puntaje es un número sin indicación.
  if(!atrialFibrillation)return NextResponse.json({patientId,applicable:false,score:r.score,components:r.components,
   reason:"Sin fibrilación o flutter auricular ACTIVO registrado: CHA₂DS₂-VASc valora el riesgo embólico de la FA no valvular. El puntaje se informa como dato, sin recomendación terapéutica.",
   valueSetVersion:ICD10_VALUE_SET_VERSION,algorithm:{id:"CHA2DS2-VASC",version:"3"}},{status:200});
  return NextResponse.json({patientId,applicable:true,score:r.score,risk:r.risk,recommendation:r.recommendation,
   components:r.components,bleedingRiskAssessed:r.bleedingRiskAssessed,
   valueSetVersion:ICD10_VALUE_SET_VERSION,algorithm:{id:"CHA2DS2-VASC",version:"3"}},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
