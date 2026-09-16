import{handleTransfusionOrder}from"../../../../lib/transfusion-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleTransfusionOrder(req);}
