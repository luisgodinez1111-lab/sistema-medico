import{handleClaimDraft}from"../../../../lib/claim-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleClaimDraft(req);}
