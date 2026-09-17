import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{anionGap,correctedCalcium,correctedSodiumForGlucose,calculatedOsmolality}from"../../../../../../../../packages/lab-derivations/src";
import{latestResultValueForAnalyte}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BN — GET /api/v1/patients/:id/metabolic-panel (derivaciones multi-analito: anion gap, calcio corregido)
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function val(fn:Promise<string|undefined>):Promise<number|undefined>{const s=await fn;if(s===undefined)return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const[na,cl,hco3,ca,alb,glu,bun]=await Promise.all([
   val(latestResultValueForAnalyte(tctx,patientId,"SODIUM")),
   val(latestResultValueForAnalyte(tctx,patientId,"CHLORIDE")),
   val(latestResultValueForAnalyte(tctx,patientId,"BICARBONATE")),
   val(latestResultValueForAnalyte(tctx,patientId,"CALCIUM")),
   val(latestResultValueForAnalyte(tctx,patientId,"ALBUMIN")),
   val(latestResultValueForAnalyte(tctx,patientId,"GLUCOSE")),
   val(latestResultValueForAnalyte(tctx,patientId,"BUN")),
  ]);
  const ag=(na!==undefined&&cl!==undefined&&hco3!==undefined)?anionGap(na,cl,hco3):undefined;
  const cca=(ca!==undefined&&alb!==undefined)?correctedCalcium(ca,alb):undefined;
  const cna=(na!==undefined&&glu!==undefined)?correctedSodiumForGlucose(na,glu):undefined;
  const osm=(na!==undefined&&glu!==undefined&&bun!==undefined)?calculatedOsmolality(na,glu,bun):undefined;
  const missing:string[]=[];
  if(ag===undefined)missing.push("anionGap: requiere SODIUM+CHLORIDE+BICARBONATE");
  if(cca===undefined)missing.push("correctedCalcium: requiere CALCIUM+ALBUMIN");
  if(cna===undefined)missing.push("correctedSodium: requiere SODIUM+GLUCOSE");
  if(osm===undefined)missing.push("osmolality: requiere SODIUM+GLUCOSE+BUN");
  return NextResponse.json({patientId,anionGap:ag??null,correctedCalcium:cca??null,correctedSodium:cna??null,osmolality:osm??null,missing},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
