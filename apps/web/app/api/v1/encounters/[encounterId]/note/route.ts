import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{readEncounterNote}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// Auditoría clínica multiespecialidad (06-oct-2026) — GET /api/v1/encounters/:id/note
//
// LA NOTA FIRMADA DEJA DE SER DE SOLO ESCRITURA. El texto de la valoración y el plan se escribían en el evento
// `ENCOUNTER_ASSESSED`, se firmaban por hash, y ninguna ruta los devolvía: `readEncounter` descarta el payload a propósito.
// Cuatro especialistas lo pusieron primero y el médico familiar lo dijo mejor que nadie: «volteo la hoja de papel y leo lo
// que escribí hace tres meses en dos segundos; aquí ese acto no tiene ruta».
//
// Devuelve PHI, así que: exige `patient:read` con propósito de TRATAMIENTO, y el lector REGISTRA el acceso en
// `phi_access_log` dentro de la misma transacción. Leer un expediente es un acto auditable, no una consulta más — y sin ese
// registro no se podría responder a un derecho de acceso ni investigar quién leyó la nota de quién.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{encounterId:string}>}){
 try{
  const{encounterId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const note=await readEncounterNote(tctx,encounterId);
  if(!note)throw new ClinicalError("NOT_FOUND","Encounter not found");
  return NextResponse.json(note,{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
