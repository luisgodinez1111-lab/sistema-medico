import{handleTransfusionCancellation}from"../../../../../../lib/transfusion-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{transfusionId:string}>}){const{transfusionId}=await pathIds(ctx.params);return handleTransfusionCancellation(req,transfusionId);}
