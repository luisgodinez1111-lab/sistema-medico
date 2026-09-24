import{handleImmunizationAdministration}from"../../../../../../lib/immunization-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{immunizationId:string}>}){const{immunizationId}=await pathIds(ctx.params);return handleImmunizationAdministration(req,immunizationId);}
