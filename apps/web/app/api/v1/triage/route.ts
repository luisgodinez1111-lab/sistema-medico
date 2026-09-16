import{handleTriageArrive}from"../../../../lib/triage-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleTriageArrive(req);}
