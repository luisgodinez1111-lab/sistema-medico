import{handleDocumentCreate}from"../../../../lib/document-lifecycle";
// EPIC I — POST /api/v1/documents  (crear documento clínico -> DRAFT)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleDocumentCreate(req);}
