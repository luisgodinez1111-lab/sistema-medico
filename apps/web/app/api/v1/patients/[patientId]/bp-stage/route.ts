import{NextResponse}from"next/server";
import{calcReceipt,CLINICAL_USE_WARNING}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{stageBloodPressure,parseBp}from"../../../../../../../../packages/bp-staging/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readVitalInputs,vitalProvenance,vitalNotComputable,MAX_VITAL_AGE_HOURS}from"../../../../../../lib/vital-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BT — GET /api/v1/patients/:id/bp-stage (estadificación ACC/AHA 2017 de la última presión arterial)
export const runtime="nodejs";
export const dynamic="force-dynamic";
const ALG={id:"BP-STAGE",version:"2",authority:"ACC/AHA 2017 (adultos ≥18 años)"}as const;
// La estadificación ACC/AHA 2017 es de ADULTOS. En pediatría la hipertensión se define por percentiles de sistólica y
// diastólica según edad, sexo y TALLA (AAP 2017): no se puede derivar de S/D sin esas tablas, que este sistema no tiene.
const MIN_ADULT_AGE_YEARS=18;
function ageYears(birthDate:string|undefined):number|undefined{
 if(!birthDate)return undefined;const b=new Date(birthDate),a=new Date();if(Number.isNaN(b.getTime()))return undefined;
 let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Auditoría R03-11: la toma se verifica (unidad mmHg, plausibilidad, vigencia) antes de estadificar; `latestVitalReadings`
  // ya excluye las tomas anuladas y usa el valor enmendado.
  const vit=await readVitalInputs(tctx,patientId,[{vitalType:"BP",maxAgeHours:MAX_VITAL_AGE_HOURS.BP_STAGING}]);
  if(!vit.ok)return NextResponse.json({patientId,computable:false,...vitalNotComputable(vit),algorithm:ALG},{status:200});
  const parsed=parseBp(vit.values["BP"]??"");
  if(!parsed)return NextResponse.json({patientId,computable:false,reason:"Formato de presión no reconocido (esperado S/D)",algorithm:ALG},{status:200});
  const demo=await patientDemographics(tctx,patientId);
  const age=ageYears(demo?.birthDate);
  // Auditoría R03-16: en un niño, «120/80» no es «presión elevada» ni «normal»: es un valor que solo significa algo
  // contra los percentiles por edad/sexo/talla. Se devuelve NO APLICABLE con los números, no una etiqueta de adulto.
  if(age!==undefined&&age<MIN_ADULT_AGE_YEARS)
   return NextResponse.json({patientId,computable:false,applicable:false,pediatric:true,reasonCode:"PEDIATRIC_PERCENTILE_REQUIRED",
    systolic:parsed.systolic,diastolic:parsed.diastolic,
    reason:`Paciente pediátrico (${age} años): la hipertensión se define por percentiles de PA según edad, sexo y talla (AAP 2017). Las categorías ACC/AHA de adulto no aplican.`,
    algorithm:ALG,inputs:vitalProvenance(vit.inputs)},{status:200});
  const r=stageBloodPressure(parsed.systolic,parsed.diastolic);
  // R03-16: `stageBloodPressure` rechaza sistólica ≤ diastólica (antes «80/120» salía «Hipertensión estadio 2»).
  if(!r)return NextResponse.json({patientId,computable:false,reasonCode:"BP_INVERTED",
   reason:`Presión ${parsed.systolic}/${parsed.diastolic}: la sistólica debe ser mayor que la diastólica. Verifique la captura.`,
   algorithm:ALG},{status:200});
  return NextResponse.json({patientId,computable:true,applicable:true,systolic:r.systolic,diastolic:r.diastolic,stage:r.stage,label:r.label,actionNote:r.actionNote,
   algorithm:ALG,inputs:vitalProvenance(vit.inputs),warnings:vit.warnings,
   receipt:calcReceipt(ALG,{systolic:r.systolic,diastolic:r.diastolic,ageYears:age,inputs:vitalProvenance(vit.inputs),usageWarning:CLINICAL_USE_WARNING},"COMPUTED",r.stage)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
