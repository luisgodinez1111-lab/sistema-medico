import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{fib4}from"../../../../../../../../packages/liver-fibrosis/src";
import{patientDemographics,latestResultValueForAnalyte}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BR — GET /api/v1/patients/:id/fib4 (índice de fibrosis hepática FIB-4)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(birthDate:string):number{
 const b=new Date(birthDate),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
async function num(fn:Promise<string|undefined>):Promise<number|undefined>{const s=await fn;if(s===undefined)return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const age=ageYears(demo.birthDate);
  const[ast,alt,plt]=await Promise.all([
   num(latestResultValueForAnalyte(tctx,patientId,"AST")),
   num(latestResultValueForAnalyte(tctx,patientId,"ALT")),
   num(latestResultValueForAnalyte(tctx,patientId,"PLATELETS")),
  ]);
  const missing=["AST","ALT","PLATELETS"].filter((_,i)=>[ast,alt,plt][i]===undefined);
  if(missing.length)return NextResponse.json({patientId,computable:false,reason:`Requiere ${missing.join("+")}`},{status:200});
  const r=fib4(age,ast!,alt!,plt!);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,ageYears:age,fib4:r.value,risk:r.risk,interpretation:r.interpretation},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
