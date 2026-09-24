import{parseBp}from"../../../../../../../../packages/bp-staging/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{computeNEWS2,type News2Params}from"../../../../../../../../packages/lab-reference/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readVitalInputs,vitalProvenance,MAX_VITAL_AGE_HOURS}from"../../../../../../lib/vital-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BC — GET /api/v1/patients/:id/news2  (NEWS2 desde los últimos signos vitales; metadatos sin PHI)
import{ageInYears}from"../../../../../../../../packages/prescription-safety/src";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function num(s:string|undefined):number|undefined{if(s===undefined)return undefined;const n=Number(String(s).trim());return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Auditoría C-09: NEWS2 está validado en adultos (≥16). El O₂ suplementario, la escala de SpO₂ y el nivel de conciencia
  // no son signos vitales registrados: se declaran en la consulta (?o2=true|false, ?spo2Scale=1|2, ?avpu=A|V|P|U). Lo que
  // no se declara FALTA, y con faltantes el score es una cota inferior (nunca "riesgo bajo").
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)return NextResponse.json({patientId,computable:false,reason:"Paciente sin fecha de nacimiento registrada"},{status:200});
  const age=ageInYears(demo.birthDate,new Date().toISOString());
  if(age===undefined||age<16)return NextResponse.json({patientId,computable:false,reason:"NEWS2 no está validado en menores de 16 años (use una escala pediátrica de alerta temprana, p. ej. PEWS)"},{status:200});
  const q=new URL(req.url).searchParams;
  const o2=q.get("o2");const supplementalO2=o2==="true"?true:o2==="false"?false:undefined;
  const spo2Scale=q.get("spo2Scale")==="2"?2:1;
  const avpu=q.get("avpu")?.toUpperCase();const consciousness=avpu&&["A","V","P","U"].includes(avpu)?avpu:undefined;
  // Auditoría R03-11: NEWS2 es una escala de DETERIORO AGUDO. Una toma de hace días no describe el estado actual: las
  // tomas con más de 8 h no entran al score (y su ausencia lo vuelve una cota inferior declarada, no un riesgo bajo).
  // La guarda además convierte a la unidad canónica (°C, %, lpm, rpm, mmHg), excluye tomas anuladas y usa las enmiendas.
  const vit=await readVitalInputs(tctx,patientId,
   (["RESP","SPO2","TEMP","HR","BP"] as const).map(vitalType=>({vitalType,maxAgeHours:MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION})));
  // A diferencia de CURB-65, NEWS2 SÍ puntúa con faltantes (declarándolo): un signo obsoleto o implausible se trata como
  // ausente para que el score siga siendo una cota inferior honesta en vez de un "no computable" que oculta el deterioro.
  const used=vit.ok?vit.inputs:[];
  const val=(t:string):number|undefined=>num(used.find(x=>x.vitalType===t)?.value);
  const bp=used.find(x=>x.vitalType==="BP")?.value;
  const sbp=bp?parseBp(bp)?.systolic:undefined; // C-21: parser único
  const params:News2Params={resp:val("RESP"),spo2:val("SPO2"),temp:val("TEMP"),hr:val("HR"),sbp,supplementalO2,spo2Scale,consciousness};
  const news2=computeNEWS2(params);
  const excluidos=vit.ok?[]:[...vit.stale,...vit.implausible];
  return NextResponse.json({patientId,computable:true,ageYears:age,news2,algorithm:{id:"NEWS2-RCP-2017",version:"2",spo2Scale},
   inputs:vitalProvenance(used),warnings:vit.ok?vit.warnings:[],
   ...(excluidos.length?{excludedInputs:excluidos}:{}),
   note:news2.complete?undefined:`Score parcial (cota inferior): faltan ${news2.missing.join(", ")}${excluidos.length?` · no utilizables: ${excluidos.join("; ")}`:""}. Con esos datos el riesgo solo puede subir.`},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
