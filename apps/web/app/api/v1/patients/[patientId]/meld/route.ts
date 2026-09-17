import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{meldScore}from"../../../../../../../../packages/meld/src";
import{latestResultValueForAnalyte}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BW — GET /api/v1/patients/:id/meld (pronóstico de hepatopatía avanzada: bilirrubina + INR + creatinina)
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function num(fn:Promise<string|undefined>):Promise<number|undefined>{const s=await fn;if(s===undefined)return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const[bili,inr,creat]=await Promise.all([
   num(latestResultValueForAnalyte(tctx,patientId,"BILIRUBIN")),
   num(latestResultValueForAnalyte(tctx,patientId,"INR")),
   num(latestResultValueForAnalyte(tctx,patientId,"CREATININE")),
  ]);
  const missing=["BILIRUBIN","INR","CREATININE"].filter((_,i)=>[bili,inr,creat][i]===undefined);
  if(missing.length)return NextResponse.json({patientId,computable:false,reason:`Requiere ${missing.join("+")}`},{status:200});
  const r=meldScore(bili!,inr!,creat!);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,meld:r.score,risk:r.risk,mortality90d:r.mortality90d},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
