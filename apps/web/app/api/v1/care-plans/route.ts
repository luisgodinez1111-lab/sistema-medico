import{handleCarePlanPropose}from"../../../../lib/careplan-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleCarePlanPropose(req);}
