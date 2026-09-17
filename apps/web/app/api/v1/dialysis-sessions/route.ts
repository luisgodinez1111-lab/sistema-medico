import{handleDialysisSchedule}from"../../../../lib/dialysis-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleDialysisSchedule(req);}
