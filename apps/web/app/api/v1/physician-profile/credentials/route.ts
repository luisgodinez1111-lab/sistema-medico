import{handleCredentialsSet}from"../../../../../lib/physician-profile-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Auditoría L-05 — POST /api/v1/physician-profile/credentials: identidad profesional del médico (nombre, cédula, institución).
export async function POST(req:Request){return handleCredentialsSet(req);}
