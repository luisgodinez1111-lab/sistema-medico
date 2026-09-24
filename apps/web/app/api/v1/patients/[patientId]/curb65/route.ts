import{NextResponse}from"next/server";
import{calcReceipt,CLINICAL_USE_WARNING}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{curb65,curb65Check,CURB65_MIN_AGE_YEARS}from"../../../../../../../../packages/pneumonia-severity/src";
import{parseBp}from"../../../../../../../../packages/bp-staging/src";
import{inValueSet,ICD10_VALUE_SETS,ICD10_VALUE_SET_VERSION}from"../../../../../../../../packages/terminology/src";
import{patientDemographics,activeProblemCodes}from"../../../../../../lib/clinical-runtime";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,notComputable}from"../../../../../../lib/analyte-inputs";
import{readVitalInputs,vitalProvenance,vitalNotComputable,MAX_VITAL_AGE_HOURS}from"../../../../../../lib/vital-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// EPIC BZ — GET /api/v1/patients/:id/curb65 (gravedad de neumonía -> decisión de ingreso)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
const ALG={id:"CURB-65",version:"3",authority:"Lim WS et al., Thorax 2003;58:377-382"}as const;
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const age=ageYears(demo.birthDate);
  // Auditoría R03-04: el CURB-65 estratifica la gravedad de una NEUMONÍA ADQUIRIDA EN LA COMUNIDAD. Sin ese diagnóstico
  // activo, «edad ≥65 + BUN >19» son dos datos de un paciente cualquiera: el score devolvía «considerar ingreso» para un
  // anciano con insuficiencia renal y sin infección. La aplicabilidad se comprueba ANTES de leer laboratorio y vitales.
  // Auditoría R03-17: los códigos se emparejan con un value set versionado (J12–J18, insensible al punto decimal) y
  // `activeProblemCodes` solo devuelve problemas ACTIVOS, así que una neumonía RESUELTA no vuelve aplicable la escala.
  const codes=await activeProblemCodes(tctx,patientId);
  if(!inValueSet(codes,ICD10_VALUE_SETS.pneumonia))
   return NextResponse.json({patientId,applicable:false,computable:false,reasonCode:"NO_PNEUMONIA_DIAGNOSIS",
    reason:"Sin neumonía adquirida en la comunidad ACTIVA registrada (J12–J18): el CURB-65 no estratifica a un paciente sin ese diagnóstico. No se emite puntaje ni recomendación de ingreso.",
    valueSetVersion:ICD10_VALUE_SET_VERSION,algorithm:ALG},{status:200});
  // Auditoría R03-18: la escala se derivó y validó en adultos. Un lactante con neumonía se estratifica con criterios
  // pediátricos, no con «edad ≥65 = 1 punto».
  if(age<CURB65_MIN_AGE_YEARS)
   return NextResponse.json({patientId,applicable:false,computable:false,reasonCode:"BELOW_VALIDATED_AGE",
    reason:`CURB-65 se derivó y validó en adultos (≥${CURB65_MIN_AGE_YEARS} años); el paciente tiene ${age}. La gravedad de la neumonía pediátrica requiere criterios propios (no implementados).`,
    algorithm:ALG},{status:200});
  // Auditoría R03-11: la decisión de ingreso se toma con la exploración de este turno. FR y PA con más de 8 h dejan de
  // ser utilizables (antes se usaba «la última», aunque fuera de hace tres semanas, y sin decirlo).
  const[inp,vit]=await Promise.all([
   readAnalyteInputs(tctx,patientId,[{analyte:"BUN",maxAgeDays:MAX_AGE_DAYS.ACUTE_INFECTION}]),
   readVitalInputs(tctx,patientId,[{vitalType:"RESP",maxAgeHours:MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION},{vitalType:"BP",maxAgeHours:MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION}]),
  ]);
  if(!inp.ok)return NextResponse.json({patientId,applicable:true,computable:false,...notComputable(inp),algorithm:ALG},{status:200});
  if(!vit.ok)return NextResponse.json({patientId,applicable:true,computable:false,...vitalNotComputable(vit),algorithm:ALG},{status:200});
  const bun=inp.values["BUN"];const resp=Number(vit.values["RESP"]);const pb=parseBp(vit.values["BP"]??"");
  if(bun===undefined||!Number.isFinite(resp)||!pb)return NextResponse.json({patientId,applicable:true,computable:false,reason:"Entradas no utilizables tras la verificación",algorithm:ALG},{status:200});
  const args={bun,respRate:resp,systolic:pb.systolic,diastolic:pb.diastolic,ageYears:age};
  // El dominio se comprueba explícitamente para poder decir POR QUÉ no se calcula (implausible, PA invertida…).
  const rej=curb65Check({confusion:false,...args});
  if(rej)return NextResponse.json({patientId,applicable:true,computable:false,reasonCode:rej.reasonCode,reason:rej.detail,algorithm:ALG},{status:200});
  // Auditoría R03-18: la confusión NO se asume. El médico la declara (?confusion=true|false). Si no lo hace, la respuesta
  // NO trae un `risk` ni una `recommendation` únicos —serían el escenario optimista presentado como el hecho—: trae el
  // RANGO entre los dos escenarios y la acción que falta (valorar el estado mental).
  const confParam=new URL(req.url).searchParams.get("confusion");
  const confusionAssessed=confParam==="true"||confParam==="false";
  const common={patientId,applicable:true,computable:true,algorithm:ALG,valueSetVersion:ICD10_VALUE_SET_VERSION,
   inputs:[...provenance(inp.inputs),...vitalProvenance(vit.inputs)],warnings:[...inp.warnings,...vit.warnings]};
  if(confusionAssessed){
   const r=curb65({confusion:confParam==="true",...args})!;
   return NextResponse.json({...common,confusionAssessed:true,confusion:confParam==="true",score:r.score,criteria:r.criteria,
    risk:r.risk,recommendation:r.recommendation,mortality:r.mortality,mortalityPct:r.mortalityPct,
    receipt:calcReceipt(ALG,{...args,confusion:confParam==="true",inputs:common.inputs},"COMPUTED",r.score),usageWarning:CLINICAL_USE_WARNING},{status:200});
  }
  const lo=curb65({confusion:false,...args})!,hi=curb65({confusion:true,...args})!;
  return NextResponse.json({...common,confusionAssessed:false,reasonCode:"CONFUSION_NOT_ASSESSED",
   scoreRange:{min:lo.score,max:hi.score},riskRange:{min:lo.risk,max:hi.risk},mortalityRange:{minPct:lo.mortalityPct,maxPct:hi.mortalityPct},
   criteria:{...lo.criteria,confusion:null},
   ifNotConfused:{score:lo.score,risk:lo.risk,recommendation:lo.recommendation,mortality:lo.mortality},
   ifConfused:{score:hi.score,risk:hi.risk,recommendation:hi.recommendation,mortality:hi.mortality},
   action:"ASSESS_CONFUSION",
   reason:"Confusión NO valorada: sin ese criterio el CURB-65 no tiene un valor único. Valore el estado mental (p. ej. AMT ≤8 o desorientación nueva) y repita la consulta con ?confusion=true|false.",
   receipt:calcReceipt(ALG,{...args,confusion:null,inputs:common.inputs},"INSUFFICIENT_DATA"),usageWarning:CLINICAL_USE_WARNING,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
