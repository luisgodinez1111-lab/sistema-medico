import{handleConsentDraft}from"../../../../lib/consent-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleConsentDraft(req);}
