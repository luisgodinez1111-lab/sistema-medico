import{handleLogin,handleLogout}from"../../../../lib/session-issuance";
// EPIC E/L — POST: login (identidad verificada -> sesión firmada + cookie httpOnly).
//           DELETE: logout (borra la cookie).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleLogin(req);}
export async function DELETE(req:Request){return handleLogout(req);}
