import{NextResponse}from"next/server";
import{createHash}from"node:crypto";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{buildRecordManifest,canonicalManifest}from"../../../../../../../../packages/record-export/src";
import{readPatientRecordRows,recordPhiAccess}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC AB — GET /api/v1/patients/:id/export  (manifiesto del expediente + hash reproducible, NOM-024).
// contentHash = sha256 del manifiesto canónico (SIN generatedAt) -> exportaciones idénticas => mismo hash.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"record:export",purpose:"TREATMENT"});
  const rows=await readPatientRecordRows(tctx,patientId);
  // R01-026: exportar un expediente es el acceso de lectura de mayor alcance; queda registrado como EXPORT.
  await recordPhiAccess(tctx,{resourceType:"RECORD_EXPORT",resourceId:patientId,patientId,action:"EXPORT"});
  const manifest=buildRecordManifest(patientId,rows);
  const contentHash=createHash("sha256").update(canonicalManifest(manifest)).digest("hex");
  return NextResponse.json({manifest,contentHash,generatedAt:new Date().toISOString()},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
