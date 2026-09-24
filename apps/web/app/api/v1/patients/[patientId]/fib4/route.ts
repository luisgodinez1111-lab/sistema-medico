import{NextResponse}from"next/server";
import{calcReceipt}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{fib4}from"../../../../../../../../packages/liver-fibrosis/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
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
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const age=ageYears(demo.birthDate);
  // AST, ALT y plaquetas VERIFICADOS (unidad canónica: plaquetas en 10^3/µL — antes 250000 /µL daba FIB-4 = 0.00) y de un mismo periodo.
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"AST",maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL},{analyte:"ALT",maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL},{analyte:"PLATELETS",maxAgeDays:MAX_AGE_DAYS.LIVER_PANEL}],{coherenceHours:COHERENCE_HOURS.LIVER_PANEL});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  const ast=inp.values["AST"],alt=inp.values["ALT"],plt=inp.values["PLATELETS"];
  const r=fib4(age,ast!,alt!,plt!);
  // R03-20: un FIB-4 fuera de [0.1, 100] delata una unidad cruzada (plaquetas en /µL dan 0.00 con «fibrosis poco
  // probable»), no un caso extremo. El paquete lo rechaza y aquí se explica, en vez de un genérico «valores inválidos».
  if(!r)return NextResponse.json({patientId,computable:false,reasonCode:"IMPLAUSIBLE_RESULT",
   reason:`FIB-4 no interpretable con esas entradas (edad ${age}, AST ${ast}, ALT ${alt}, plaquetas ${plt}). Las plaquetas deben venir en 10⁹/L (≡10³/µL): un recuento absoluto (p. ej. 250 000/µL) produce un índice mil veces menor y una lectura falsamente tranquilizadora.`,
   algorithm:{id:"FIB-4",version:"2",authority:"Sterling RK et al., Hepatology 2006; corte por edad McPherson 2017"}},{status:200});
  return NextResponse.json({patientId,computable:true,ageYears:age,fib4:r.value,risk:r.risk,interpretation:r.interpretation,lowCutoff:r.lowCutoff,ageAdjusted:r.ageAdjusted,
   algorithm:{id:"FIB-4",version:"2",authority:"Sterling RK et al., Hepatology 2006; corte por edad McPherson 2017"},inputs:provenance(inp.inputs),warnings:inp.warnings,
   receipt:calcReceipt({id:"FIB-4",version:"2",authority:"Sterling RK et al., Hepatology 2006"},{ageYears:age,ast,alt,platelets:plt,inputs:provenance(inp.inputs)},"COMPUTED",r.value)},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
