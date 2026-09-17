import{handleSurgerySchedule}from"../../../../lib/surgery-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleSurgerySchedule(req);}
