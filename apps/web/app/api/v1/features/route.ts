import{NextResponse}from"next/server";
import{resolveVerified}from"../../../../lib/http-command";
import{toHttpError}from"../../../../lib/http-errors";
import{clientFeatures}from"../../../../lib/feature-flags";
// GET /api/v1/features — capacidades que la UI necesita para decidir qué pinta (hoy: verticales hospitalarias). Sin PHI.
// Exige sesión válida (no revela la configuración a anónimos); no requiere scope clínico porque no toca datos de pacientes.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 try{resolveVerified(req);return NextResponse.json(clientFeatures(),{status:200,headers:{"cache-control":"no-store"}});}
 catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
