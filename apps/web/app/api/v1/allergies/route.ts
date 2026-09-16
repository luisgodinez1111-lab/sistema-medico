import{handleAllergyCreate}from"../../../../lib/allergy-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAllergyCreate(req);}
