import{handleLogin}from"../../../../lib/session-issuance";
// EPIC E — POST /api/v1/sessions  (login: identidad verificada -> sesión firmada medical-os)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleLogin(req);}
