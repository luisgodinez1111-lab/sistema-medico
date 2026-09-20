import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{computeEGFR,type Sex}from"../../../../../../../../packages/renal-function/src";
import{patientDemographics}from"../../../../../../lib/clinical-runtime";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,notComputable as notComputableBody}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BL — GET /api/v1/patients/:id/egfr (función renal CKD-EPI 2021 + estadio ERC; metadatos sin PHI cruda)
export const runtime="nodejs";
export const dynamic="force-dynamic";
function ageYears(birthDate:string,asOf:string):number{
 const b=new Date(birthDate),a=new Date(asOf);
 if(Number.isNaN(b.getTime())||Number.isNaN(a.getTime()))return NaN;
 let y=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;
 return y;
}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const demo=await patientDemographics(tctx,patientId);
  if(!demo?.birthDate)throw new ClinicalError("NOT_FOUND","Patient not registered (demographics unavailable)");
  const asOf=new Date().toISOString();
  const age=ageYears(demo.birthDate,asOf);
  const sex=demo.sexAtBirth;
  // Entrada VERIFICADA: unidad (mg/dL canónica), plausibilidad y vigencia de la creatinina.
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"CREATININE",maxAgeDays:MAX_AGE_DAYS.RENAL_FUNCTION}]);
  const notComputable=(reason:string)=>NextResponse.json({patientId,computable:false,reason,ageYears:age},{status:200});
  if(sex!=="FEMALE"&&sex!=="MALE")return notComputable("Sexo no binario/desconocido: CKD-EPI requiere sexo (FEMALE/MALE)");
  if(!(age>=18))return notComputable("Paciente pediátrico (<18): usar ecuación de Schwartz, no CKD-EPI");
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputableBody(inp),ageYears:age},{status:200});
  const scr=inp.values["CREATININE"]!;
  const r=computeEGFR(scr,age,sex as Sex);
  if(!r)return notComputable("Valores inválidos para el cálculo");
  return NextResponse.json({patientId,computable:true,ageYears:age,creatinineMgDl:scr,egfr:r.egfr,stage:r.stage,label:r.label,
   // Una sola creatinina NO establece cronicidad (KDIGO exige ≥3 meses) ni distingue lesión renal aguda.
   caveat:"Estadio estimado a partir de UNA creatinina: no confirma ERC (requiere ≥3 meses) ni descarta lesión renal aguda; falta albuminuria.",
   algorithm:{id:"CKD-EPI-2021",version:"1"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
