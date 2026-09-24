import{handleWoundEscalation}from"../../../../../../lib/wound-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{woundId:string}>}){const{woundId}=await pathIds(ctx.params);return handleWoundEscalation(req,woundId);}
