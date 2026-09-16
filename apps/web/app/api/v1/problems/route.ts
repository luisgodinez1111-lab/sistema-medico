import{handleProblemCreate}from"../../../../lib/problem-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleProblemCreate(req);}
