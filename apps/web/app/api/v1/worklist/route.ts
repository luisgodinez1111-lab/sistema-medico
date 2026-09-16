import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{computePanelWorklist}from"../../../../../../packages/care-gaps/src";
import{readTenantOpenAggregates}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC AC — GET /api/v1/worklist  (worklist poblacional del panel: care gaps de todos los pacientes del tenant)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const rows=await readTenantOpenAggregates(ctx);
  const gaps=computePanelWorklist(rows);
  const patientCount=new Set(gaps.map(g=>g.patientId)).size;
  return NextResponse.json({gaps,gapCount:gaps.length,patientCount},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
