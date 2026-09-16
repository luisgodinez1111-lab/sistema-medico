import{handleOrderFulfillment}from"../../../../../../lib/order-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{orderId:string}>}){const{orderId}=await ctx.params;return handleOrderFulfillment(req,orderId);}
