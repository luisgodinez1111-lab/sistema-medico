import{handleIncidentResolution}from"../../../../../../lib/incident-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{incidentId:string}>}){const{incidentId}=await ctx.params;return handleIncidentResolution(req,incidentId);}
