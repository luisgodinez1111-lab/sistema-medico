import{handleOrderCreate}from"../../../../lib/order-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleOrderCreate(req);}
