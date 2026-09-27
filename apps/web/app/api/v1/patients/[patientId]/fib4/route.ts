import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{fib4}from"../../../../../../../../packages/liver-fibrosis/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC BR — GET /api/v1/patients/:id/fib4 (índice de fibrosis hepática FIB-4)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(birthDate:string):number{
 const b=new Date(birthDate),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;
}
async function num(fn:Promise<string|undefined>):Promise<number|undefined>{const s=await fn;if(s===undefined)return undefined;const n=Number(s);return Number.isFinite(n)?n:undefined;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const age=ageYears(demo.birthDate);
  // AST, ALT y plaquetas VERIFICADOS (unidad canónica: plaquetas en 10^3/µL — antes 250000 /µL daba FIB-4 = 0.00) y de un mismo periodo.
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"AST",maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL},{analyte:"ALT",maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL},{analyte:"PLATELETS",maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL}],{coherenceHours:COHERENCE_HOURS.LIVER_PANEL});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  const ast=inp.values["AST"],alt=inp.values["ALT"],plt=inp.values["PLATELETS"];
  const r=fib4(age,ast!,alt!,plt!);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,ageYears:age,fib4:r.value,risk:r.risk,interpretation:r.interpretation,algorithm:{id:"FIB-4",version:"1"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
