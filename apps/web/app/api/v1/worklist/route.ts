import{NextResponse}from"next/server";
import{computePanelWorklist}from"../../../../../../packages/care-gaps/src";
import{readTenantOpenAggregates,clampLimit,decodeCursor,encodeCursor}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
// EPIC AC — GET /api/v1/worklist  (worklist poblacional del panel: care gaps de todos los pacientes del tenant)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"patient:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  // Auditoría R04-008 — la LECTURA está acotada, no solo la respuesta: la consulta se limita a los tipos de agregado que
  // alguna regla mira (derivado de las reglas, no escrito a mano) y lleva un techo declarado.
  const{rows,truncated}=await readTenantOpenAggregates(ctx);
  const all=computePanelWorklist(rows);
  const patientCount=new Set(all.map(g=>g.patientId)).size;
  // Auditoría S-08: la lista completa se calcula en memoria (es determinista) pero la RESPUESTA se pagina:
  // ?limit=1..500 (100 por defecto) y ?cursor= (desplazamiento opaco). gapCount/patientCount siguen siendo totales.
  const u=new URL(req.url);const limit=clampLimit(u.searchParams.get("limit"));
  const c=decodeCursor(u.searchParams.get("cursor"),1);const offset=c&&Number.isInteger(c[0])&&Number(c[0])>=0?Number(c[0]):0;
  const gaps=all.slice(offset,offset+limit);
  // `truncated` se DICE: si el consultorio supera el techo de lectura, el panel no está completo y el médico debe
  // saberlo. Un panel que oculta pendientes sin avisar es peor que uno lento — y `gapCount` dejaría de ser un total.
  return NextResponse.json({gaps,gapCount:all.length,patientCount,truncated,
   ...(truncated?{truncatedNote:"El consultorio supera el techo de lectura del panel: esta lista NO está completa. Filtra por paciente o pide la ampliación del techo."}:{}),
   nextCursor:offset+limit<all.length?encodeCursor([offset+limit]):null},{status:200});
 });
}
