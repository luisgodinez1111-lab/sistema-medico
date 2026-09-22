import{parseBp}from"../../../../../../../../packages/bp-staging/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{curb65}from"../../../../../../../../packages/pneumonia-severity/src";
import{patientDemographics,latestVitalsByType}from"../../../../../../lib/clinical-runtime";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BZ — GET /api/v1/patients/:id/curb65 (gravedad de neumonía -> decisión de ingreso)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function num(s:string|undefined):number|undefined{if(s===undefined)return undefined;const n=Number(String(s).trim());return Number.isFinite(n)?n:undefined;}
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const[vitals,inp]=await Promise.all([latestVitalsByType(tctx,patientId),readAnalyteInputs(tctx,patientId,[{analyte:"BUN",maxAgeDays:MAX_AGE_DAYS.ACUTE_INFECTION}])]);
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  const bun:number|undefined=inp.values["BUN"];const resp=num(vitals["RESP"]);
  const pb=vitals["BP"]?parseBp(vitals["BP"]):undefined;const sys=pb?.systolic,dia=pb?.diastolic; // C-21: parser único
  const missing:string[]=[];
  if(bun===undefined)missing.push("BUN");
  if(resp===undefined)missing.push("RESP");
  if(sys===undefined||dia===undefined)missing.push("BP");
  if(missing.length)return NextResponse.json({patientId,computable:false,reason:`Requiere ${missing.join("+")}`},{status:200});
  // Auditoría C-18: la confusión NO se captura como dato estructurado. Antes se fijaba en `false` y el puntaje y la
  // recomendación de ingreso salían subestimados. Ahora el médico la declara (?confusion=true|false); si no lo hace,
  // el puntaje se informa como MÍNIMO y se devuelve también el escenario "si está confuso".
  const confParam=new URL(req.url).searchParams.get("confusion");const confusionAssessed=confParam==="true"||confParam==="false";
  const args={bun:bun!,respRate:resp!,systolic:sys!,diastolic:dia!,ageYears:ageYears(demo.birthDate)};
  const r=curb65({confusion:confParam==="true",...args});
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  const worst=confusionAssessed?undefined:curb65({confusion:true,...args});
  return NextResponse.json({patientId,computable:true,score:r.score,criteria:r.criteria,risk:r.risk,recommendation:r.recommendation,mortality:r.mortality,
   confusionAssessed,scoreIsLowerBound:!confusionAssessed,
   ...(worst?{ifConfused:{score:worst.score,risk:worst.risk,recommendation:worst.recommendation,mortality:worst.mortality}}:{}),
   note:confusionAssessed?undefined:"Confusión NO valorada: el puntaje mostrado es el MÍNIMO. Si el paciente está confuso aplica `ifConfused`. Los signos vitales usados son los últimos registrados (sin verificación de vigencia).",
   algorithm:{id:"CURB-65",version:"2"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
