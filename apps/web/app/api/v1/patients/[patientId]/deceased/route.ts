import{handlePatientDeceased}from"../../../../../../lib/patient-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// EPIC S / auditoría R02a-PAT-03 — POST /api/v1/patients/:id/deceased: registro de defunción.
// `DECEASED` era un estado declarado por el fold y consumido por `requireRegisteredPatient` (409 a todo registro clínico
// nuevo) que NINGUNA ruta podía producir: la protección existía pero era inalcanzable.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){const{patientId}=await pathIds(ctx.params);return handlePatientDeceased(req,patientId);}
