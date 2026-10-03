import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{patientChart}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// GET /api/v1/patients/:id/chart — EXPEDIENTE VIVO.
// Hidrata TODOS los módulos del expediente (problemas, alergias, medicación, signos, vacunas, órdenes, resultados) con la
// historia REAL del paciente, cada fila con su estado y su VERSIÓN (para que la UI pueda transicionar lo leído, no solo
// mostrarlo). Determinista, sin escritura, RLS-scoped. Antes el front arrancaba estos módulos vacíos (useState([])).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const chart=await patientChart(tctx,patientId);
  return NextResponse.json(chart,{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
