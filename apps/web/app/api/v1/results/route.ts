import{NextResponse}from"next/server";
import{handleResultReceived}from"../../../../lib/result-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{resultsRegistry,resultsSummary,clampLimit,PAGE_LIMIT_MAX}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC G — POST /api/v1/results  (recibir un resultado diagnóstico -> RECEIVED)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleResultReceived(req);}

// EPIC AQ/UI — GET /api/v1/results -> registro de resultados de toda la clínica (vista Resultados).
// Cada resultado con paciente, analito/valor, estado-UI derivado (Hallazgos/Normal/En seguimiento/En revisión),
// tipo (Laboratorio/Imagenología) e interpretación determinista; MÁS KPIs (totales / con hallazgos / en
// seguimiento / pendientes de revisión). RLS-scoped.
const ABNORMAL=new Set(["HIGH","LOW","CRITICAL","ABNORMAL","PANIC"]);
function tipoOf(analyte:string):"Laboratorio"|"Imagenología"{const a=analyte.toLowerCase();return /radio|rayos|tac|tc |ultrason|usg|resonan|tomograf|imagen|placa|mastograf/.test(a)?"Imagenología":"Laboratorio";}
function estadoOf(critical:boolean,status:string,lifecycle:string):"Hallazgos"|"Normal"|"En seguimiento"|"En revisión"{
 if(critical||ABNORMAL.has(status.toUpperCase()))return"Hallazgos";
 if(lifecycle==="ACTIONED")return"En seguimiento";
 if(lifecycle==="RECEIVED")return"En revisión";
 return"Normal";
}
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"result:read",purpose:"TREATMENT"});
  // R06-20: lista acotada por página; los indicadores, contados en la base con la misma regla que la lista.
  const url=new URL(req.url);
  const page=await resultsRegistry(ctx,{limit:clampLimit(url.searchParams.get("limit"),PAGE_LIMIT_MAX,PAGE_LIMIT_MAX),cursor:url.searchParams.get("cursor")});
  const items=page.items.map(r=>{const estado=estadoOf(r.critical,r.status,r.lifecycle);return{
   resultId:r.resultId,patientId:r.patientId,patientName:r.patientName,
   analyte:r.analyte,value:r.value,critical:r.critical,status:r.status,interpretation:r.interpretation,
   tipo:tipoOf(r.analyte),estado,lifecycle:r.lifecycle,receivedAt:r.receivedAt};});
  const{total,abnormal,enSeguimiento,pendientes}=await resultsSummary(ctx);
  return NextResponse.json({items,nextCursor:page.nextCursor,total,abnormal,enSeguimiento,pendientes},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
