import{handleAdmissionAdmit}from"../../../../lib/admission-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAdmissionAdmit(req);}
