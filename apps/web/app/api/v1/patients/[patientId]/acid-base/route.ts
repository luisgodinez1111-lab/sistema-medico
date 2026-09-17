import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{interpretAcidBase}from"../../../../../../../../packages/acid-base/src";
import{latestResultValueForAnalyte}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BX — GET /api/v1/patients/:id/acid-base (interpretación de gasometría: trastorno primario + Winters)
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function num(fn:Promise<string|undefined>):Promise<number|undefined>{const s=await fn;if(s===undefined)return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const[ph,pco2,hco3]=await Promise.all([
   num(latestResultValueForAnalyte(tctx,patientId,"PH")),
   num(latestResultValueForAnalyte(tctx,patientId,"PCO2")),
   num(latestResultValueForAnalyte(tctx,patientId,"BICARBONATE")),
  ]);
  const missing=["PH","PCO2","BICARBONATE"].filter((_,i)=>[ph,pco2,hco3][i]===undefined);
  if(missing.length)return NextResponse.json({patientId,computable:false,reason:`Requiere ${missing.join("+")}`},{status:200});
  const r=interpretAcidBase(ph!,pco2!,hco3!);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,ph,pco2,hco3,status:r.status,primary:r.primary,expectedPco2:r.expectedPco2??null,compensation:r.compensation??null,interpretation:r.interpretation},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
