import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{listPatientEncounters,clampLimit}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// Auditoría clínica multiespecialidad (06-oct-2026) — GET /api/v1/patients/:id/encounters
//
// EL ÍNDICE DE CONSULTAS que no existía. Cuatro especialistas, por separado, pusieron en primer lugar «no puedo leer la nota
// de la consulta anterior»; el primer obstáculo era que no había forma de SABER QUÉ CONSULTAS EXISTEN: el timeline devuelve
// metadatos sin fechas legibles y el único GET de encuentro exigía un `encounterId` que la pantalla nunca tenía.
//
// Esta ruta devuelve el índice CON FECHAS y sin contenido clínico: es lo que permite elegir una consulta. El texto se pide
// aparte (`/encounters/:id/note`), que es también donde se registra el acceso a PHI.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const u=new URL(req.url);
  const items=await listPatientEncounters(tctx,patientId,{limit:clampLimit(u.searchParams.get("limit"))});
  return NextResponse.json({patientId,items,total:items.length},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
