import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{analyteSeries,latestResultValueForAnalyte,patientEgfr}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC CH — GET /api/v1/patients/:id/trends  (panel 4: "Resultados y evolución longitudinal")
// Series temporales de analitos clave + últimos valores para el grid de "otros resultados". Determinista.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const num=(s:string|undefined)=>{if(s===undefined)return null;const n=Number(String(s).trim());return Number.isFinite(n)?n:null;};

export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const[hba1c,glucose,ldl,creatinine,latLdl,latCreat,latUacr,egfr]=await Promise.all([
   analyteSeries(tctx,patientId,"HBA1C"),
   analyteSeries(tctx,patientId,"GLUCOSE"),
   analyteSeries(tctx,patientId,"LDL"),
   analyteSeries(tctx,patientId,"CREATININE"),
   latestResultValueForAnalyte(tctx,patientId,"LDL"),
   latestResultValueForAnalyte(tctx,patientId,"CREATININE"),
   latestResultValueForAnalyte(tctx,patientId,"UACR"),
   patientEgfr(tctx,patientId),
  ]);
  return NextResponse.json({patientId,
   series:{HBA1C:hba1c,GLUCOSE:glucose,LDL:ldl,CREATININE:creatinine},
   latest:{LDL:num(latLdl),CREATININE:num(latCreat),UACR:num(latUacr),EGFR:typeof egfr==="number"&&Number.isFinite(egfr)?egfr:null}},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
