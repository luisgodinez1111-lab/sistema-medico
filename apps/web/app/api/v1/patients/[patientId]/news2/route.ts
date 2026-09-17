import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{computeNEWS2,type News2Params}from"../../../../../../../../packages/lab-reference/src";
import{latestVitalsByType}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BC — GET /api/v1/patients/:id/news2  (NEWS2 desde los últimos signos vitales; metadatos sin PHI)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function num(s:string|undefined):number|undefined{if(s===undefined)return undefined;const n=Number(String(s).trim());return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const vitals=await latestVitalsByType(tctx,patientId);
  // Presión: extraer la sistólica de "S/D".
  let sbp:number|undefined;const bp=vitals["BP"];if(bp){const m=/^(\d{2,3})/.exec(bp.trim());if(m)sbp=Number(m[1]);}
  const params:News2Params={resp:num(vitals["RESP"]),spo2:num(vitals["SPO2"]),temp:num(vitals["TEMP"]),hr:num(vitals["HR"]),sbp};
  const news2=computeNEWS2(params);
  return NextResponse.json({patientId,news2},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
