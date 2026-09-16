import{handleImmunizationDue}from"../../../../lib/immunization-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleImmunizationDue(req);}
