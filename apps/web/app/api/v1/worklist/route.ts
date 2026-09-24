import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{computePanelWorklist}from"../../../../../../packages/care-gaps/src";
import{readTenantOpenAggregates,clampLimit,decodeCursor,encodeCursor}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC AC — GET /api/v1/worklist  (worklist poblacional del panel: care gaps de todos los pacientes del tenant)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const rows=await readTenantOpenAggregates(ctx);
  const all=computePanelWorklist(rows);
  const patientCount=new Set(all.map(g=>g.patientId)).size;
  // Auditoría S-08: la lista completa se calcula en memoria (es determinista) pero la RESPUESTA se pagina:
  // ?limit=1..500 (100 por defecto) y ?cursor= (desplazamiento opaco). gapCount/patientCount siguen siendo totales.
  const u=new URL(req.url);const limit=clampLimit(u.searchParams.get("limit"));
  const c=decodeCursor(u.searchParams.get("cursor"),1);const offset=c&&Number.isInteger(c[0])&&Number(c[0])>=0?Number(c[0]):0;
  const gaps=all.slice(offset,offset+limit);
  return NextResponse.json({gaps,gapCount:all.length,patientCount,nextCursor:offset+limit<all.length?encodeCursor([offset+limit]):null},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
