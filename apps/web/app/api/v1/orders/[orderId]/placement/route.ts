import{handleOrderPlacement}from"../../../../../../lib/order-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{orderId:string}>}){try{const{orderId}=await pathIds(ctx.params);return await handleOrderPlacement(req,orderId);}catch(e){return httpErrorResponse(e);}}
