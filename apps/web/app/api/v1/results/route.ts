import{handleResultReceived}from"../../../../lib/result-lifecycle";
// EPIC G — POST /api/v1/results  (recibir un resultado diagnóstico -> RECEIVED)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleResultReceived(req);}
