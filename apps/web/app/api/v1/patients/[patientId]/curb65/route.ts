import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{curb65}from"../../../../../../../../packages/pneumonia-severity/src";
import{patientDemographics,latestVitalsByType,latestResultValueForAnalyte}from"../../../../../../lib/clinical-runtime";
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
  const[vitals,bunRaw]=await Promise.all([latestVitalsByType(tctx,patientId),latestResultValueForAnalyte(tctx,patientId,"BUN")]);
  const bun=num(bunRaw);const resp=num(vitals["RESP"]);
  let sys:number|undefined,dia:number|undefined;const bp=vitals["BP"];if(bp){const m=/^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(bp.trim());if(m){sys=Number(m[1]);dia=Number(m[2]);}}
  const missing:string[]=[];
  if(bun===undefined)missing.push("BUN");
  if(resp===undefined)missing.push("RESP");
  if(sys===undefined||dia===undefined)missing.push("BP");
  if(missing.length)return NextResponse.json({patientId,computable:false,reason:`Requiere ${missing.join("+")}`},{status:200});
  const r=curb65({confusion:false,bun:bun!,respRate:resp!,systolic:sys!,diastolic:dia!,ageYears:ageYears(demo.birthDate)});
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,score:r.score,criteria:r.criteria,risk:r.risk,recommendation:r.recommendation,mortality:r.mortality,note:"La confusión no se captura como dato estructurado; se asume ausente (valore clínicamente)"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
