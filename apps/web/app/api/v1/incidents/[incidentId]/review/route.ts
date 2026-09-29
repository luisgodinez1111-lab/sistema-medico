import{handleIncidentReview}from"../../../../../../lib/incident-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{incidentId:string}>}){try{const{incidentId}=await pathIds(ctx.params);return await handleIncidentReview(req,incidentId);}catch(e){return httpErrorResponse(e);}}
