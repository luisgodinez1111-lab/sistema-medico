import{handleObligationCreate}from"../../../../lib/obligation-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleObligationCreate(req);}
