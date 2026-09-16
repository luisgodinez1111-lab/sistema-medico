import{handleVitalRecord}from"../../../../lib/vital-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleVitalRecord(req);}
