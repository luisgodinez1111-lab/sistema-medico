import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{interpretINR}from"../../../../../../../../packages/anticoagulation/src";
import{resolveDrug}from"../../../../../../../../packages/drug-catalog/src";
import{latestResultValueForAnalyte,activeMedicationDrugCodes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BU — GET /api/v1/patients/:id/anticoagulation-status (INR interpretado en contexto del anticoagulante)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const inrRaw=await latestResultValueForAnalyte(tctx,patientId,"INR");
  // ¿Está el paciente con un antagonista de vitamina K activo? (contexto de aplicación del rango terapéutico)
  const activeDrugs=await activeMedicationDrugCodes(tctx,patientId);
  const anticoagulant=activeDrugs.find(dc=>resolveDrug(dc)?.classes.includes("ANTICOAGULANT"));
  if(inrRaw===undefined)return NextResponse.json({patientId,computable:false,reason:"Sin INR registrado",onAnticoagulant:!!anticoagulant},{status:200});
  const inr=Number(inrRaw);
  if(!Number.isFinite(inr))return NextResponse.json({patientId,computable:false,reason:"INR no numérico"},{status:200});
  const r=interpretINR(inr);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"INR inválido"},{status:200});
  return NextResponse.json({patientId,computable:true,onAnticoagulant:!!anticoagulant,anticoagulant:anticoagulant??null,inr:r.inr,status:r.status,target:r.target,interpretation:r.interpretation,note:anticoagulant?undefined:"Sin anticoagulante oral activo registrado: el rango terapéutico aplica a antagonistas de vitamina K"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
