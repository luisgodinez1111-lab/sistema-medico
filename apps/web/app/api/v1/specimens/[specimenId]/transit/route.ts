import{handleSpecimenTransit}from"../../../../../../lib/specimen-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{specimenId:string}>}){const{specimenId}=await pathIds(ctx.params);return handleSpecimenTransit(req,specimenId);}
