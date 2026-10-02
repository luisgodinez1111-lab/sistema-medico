import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{antecedentes}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
import{handleAntecedentesRecord}from"../../../../../../lib/antecedentes-lifecycle";
// MATRIZ FUNDACIONAL — /api/v1/patients/:id/antecedentes
//   GET  → estado vigente de los antecedentes del paciente (tras enmiendas). `recorded:false` si aún no se capturan.
//   POST → captura inicial (RECORDED, una vez por paciente; un segundo POST choca por version 0).
// Determinista, RLS-scoped. La enmienda vive en ./antecedentes/amendment.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"antecedentes:read",purpose:"TREATMENT"});
  const a=await antecedentes(tctx,patientId);
  return NextResponse.json(a,{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){const{patientId}=await pathIds(ctx.params);return handleAntecedentesRecord(req,patientId);}
