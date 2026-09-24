import{handleIncidentEscalation}from"../../../../../../lib/incident-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{incidentId:string}>}){const{incidentId}=await pathIds(ctx.params);return handleIncidentEscalation(req,incidentId);}
