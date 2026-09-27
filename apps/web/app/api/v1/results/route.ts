import{NextResponse}from"next/server";
import{handleResultReceived}from"../../../../lib/result-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{resultsRegistry,resultEstado}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC G — POST /api/v1/results  (recibir un resultado diagnóstico -> RECEIVED)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleResultReceived(req);}

// EPIC AQ/UI — GET /api/v1/results -> registro de resultados de toda la clínica (vista Resultados).
// Cada resultado con paciente, analito/valor, estado-UI derivado (Hallazgos/Normal/En seguimiento/En revisión/Corregido),
// tipo (Laboratorio/Imagenología) e interpretación determinista; MÁS KPIs (totales / con hallazgos / en
// seguimiento / pendientes de revisión). RLS-scoped.
function tipoOf(analyte:string):"Laboratorio"|"Imagenología"{const a=analyte.toLowerCase();return /radio|rayos|tac|tc |ultrason|usg|resonan|tomograf|imagen|placa|mastograf/.test(a)?"Imagenología":"Laboratorio";}
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"result:read",purpose:"TREATMENT"});
  const rows=await resultsRegistry(ctx);
  const items=rows.map(r=>({
   resultId:r.resultId,patientId:r.patientId,patientName:r.patientName,
   analyte:r.analyte,value:r.value,critical:r.critical,status:r.status,interpretation:r.interpretation,
   tipo:tipoOf(r.analyte),estado:resultEstado(r),lifecycle:r.lifecycle,superseded:r.superseded,receivedAt:r.receivedAt}));
  const total=items.length;
  // KPIs sobre los resultados VIGENTES: uno reemplazado por una corrección no es un hallazgo, seguimiento ni revisión
  // pendiente (lo es su corrección, que ya está en la lista).
  const vigentes=items.filter(i=>!i.superseded);
  const abnormal=vigentes.filter(i=>i.estado==="Hallazgos").length;
  const enSeguimiento=vigentes.filter(i=>i.lifecycle==="ACTIONED").length;
  const pendientes=vigentes.filter(i=>i.lifecycle==="RECEIVED").length;
  return NextResponse.json({items,total,abnormal,enSeguimiento,pendientes},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
