import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../packages/runtime-auth/src";
import{searchIcd10,lookupIcd10}from"../../../../../../../packages/terminology/src";
import{toHttpError}from"../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../lib/http-command";
// EPIC AM — GET /api/v1/terminology/icd10?q=  (búsqueda/lookup CIE-10 para codificación; sin PHI)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 try{
  const{claims}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const url=new URL(req.url);const q=url.searchParams.get("q")??"";const code=url.searchParams.get("code");
  if(code){const e=lookupIcd10(code);return NextResponse.json({entry:e??null,valid:!!e},{status:200});}
  return NextResponse.json({results:searchIcd10(q)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
