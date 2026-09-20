import{handleProfileGet}from"../../../../lib/physician-profile-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// EPIC S-CONFIG/FIRMA — GET /api/v1/physician-profile: metadatos de firma y sello del médico (sin binarios) + version.
export async function GET(req:Request){return handleProfileGet(req);}
