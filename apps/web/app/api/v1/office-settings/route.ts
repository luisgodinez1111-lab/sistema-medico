import{handleOfficeSettingsGet,handleOfficeSettingsUpdate}from"../../../../lib/office-settings-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// EPIC S-CONFIG — Ajustes del consultorio (singleton por tenant, no PHI). GET lee los ajustes efectivos + version;
// PUT persiste el merge con concurrencia optimista (If-Match). Mismo kernel event-sourced, RLS-scoped.
export async function GET(req:Request){return handleOfficeSettingsGet(req);}
export async function PUT(req:Request){return handleOfficeSettingsUpdate(req);}
