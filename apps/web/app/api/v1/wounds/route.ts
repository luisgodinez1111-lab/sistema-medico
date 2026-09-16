import{handleWoundDocument}from"../../../../lib/wound-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleWoundDocument(req);}
