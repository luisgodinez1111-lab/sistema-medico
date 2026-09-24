import{handleOrderFulfillment}from"../../../../../../lib/order-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{orderId:string}>}){const{orderId}=await pathIds(ctx.params);return handleOrderFulfillment(req,orderId);}
