import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{aaGradient}from"../../../../../../../../packages/oxygenation/src";
import{patientDemographics,latestResultValueForAnalyte}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CA — GET /api/v1/patients/:id/aa-gradient (gradiente alveolo-arterial de O2; opcional ?atm=<mmHg> por altitud)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
async function num(fn:Promise<string|undefined>):Promise<number|undefined>{const s=await fn;if(s===undefined)return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const[po2,pco2]=await Promise.all([num(latestResultValueForAnalyte(tctx,patientId,"PO2")),num(latestResultValueForAnalyte(tctx,patientId,"PCO2"))]);
  const missing=["PO2","PCO2"].filter((_,i)=>[po2,pco2][i]===undefined);
  if(missing.length)return NextResponse.json({patientId,computable:false,reason:`Requiere ${missing.join("+")}`},{status:200});
  const atmParam=Number(new URL(req.url).searchParams.get("atm"));
  const opts=Number.isFinite(atmParam)&&atmParam>0?{atmPressure:atmParam}:{};
  const r=aaGradient(po2!,pco2!,ageYears(demo.birthDate),opts);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,alveolarPo2:r.alveolarPo2,gradient:r.gradient,expected:r.expected,elevated:r.elevated,interpretation:r.interpretation},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
