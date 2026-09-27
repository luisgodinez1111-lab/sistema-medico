import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{computeBMI,heightToMeters}from"../../../../../../../../packages/anthropometrics/src";
import{latestVitalsByType,patientDemographics}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC BO — GET /api/v1/patients/:id/bmi (IMC + clasificación nutricional WHO; pediatría -> percentil)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function num(s:string|undefined):number|undefined{if(s===undefined)return undefined;const n=Number(String(s).trim());return Number.isFinite(n)?n:undefined;}
function ageYears(birthDate:string|undefined):number|undefined{
 if(!birthDate)return undefined;const b=new Date(birthDate),a=new Date();if(Number.isNaN(b.getTime()))return undefined;
 let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const vitals=await latestVitalsByType(tctx,patientId);
  const weightKg=num(vitals["WEIGHT"]);
  const heightM=heightToMeters(num(vitals["HEIGHT"])??NaN);
  const notComputable=(reason:string)=>NextResponse.json({patientId,computable:false,reason},{status:200});
  if(weightKg===undefined||heightM===undefined)return notComputable("Requiere WEIGHT y HEIGHT registrados");
  const r=computeBMI(weightKg,heightM);
  if(!r)return notComputable("Valores inválidos de peso/talla");
  const demo=await patientDemographics(tctx,patientId);
  const age=ageYears(demo?.birthDate);
  if(age!==undefined&&age<19){
   // En pediatría el IMC se interpreta con percentil IMC-para-edad, no con las categorías fijas de adulto.
   return NextResponse.json({patientId,computable:true,bmi:r.bmi,pediatric:true,note:"Paciente pediátrico (<19): interpretar con percentil IMC-para-edad, no con categorías de adulto",weightKg,heightM},{status:200});
  }
  return NextResponse.json({patientId,computable:true,bmi:r.bmi,category:r.category,label:r.label,weightKg,heightM},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
