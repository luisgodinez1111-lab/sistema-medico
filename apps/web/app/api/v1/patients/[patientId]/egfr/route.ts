import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../../../../../../packages/runtime-errors/src";
import{computeEGFR,type Sex}from"../../../../../../../../packages/renal-function/src";
import{patientDemographics,analyteSeries,latestAnalyteReading}from"../../../../../../lib/clinical-runtime";
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
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
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
  // Auditoría C-22: el estadio G de KDIGO exige CRONICIDAD (TFG < 60 persistente ≥ 90 días). Con la serie histórica de creatinina
  // se comprueba si existe una determinación ≥ 90 días antes cuyo eGFR también fuera < 60; si no, la reducción es PUNTUAL y no
  // se afirma ERC (puede ser lesión renal aguda). La albuminuria (categoría A) se informa si hay UACR, si no se declara ausente.
  const series=await analyteSeries(tctx,patientId,"CREATININE");
  const latestAt=inp.inputs[0]?.occurredAt??asOf;
  const prior90=series.filter(pt=>Date.parse(latestAt)-Date.parse(pt.at)>=90*86_400_000);
  const birth=demo.birthDate;
  const priorLow=prior90.filter(pt=>{const e=computeEGFR(pt.value,ageYears(birth,pt.at),sex as Sex);return!!e&&e.egfr<60;});
  const chronicity:{status:"CONFIRMED"|"NOT_CONFIRMED"|"NOT_APPLICABLE";note:string}=r.egfr>=60
   ?{status:"NOT_APPLICABLE",note:"TFG ≥ 60: el estadio G1/G2 no define ERC por sí solo (requiere daño renal: albuminuria u otro marcador)"}
   :priorLow.length>0?{status:"CONFIRMED",note:`TFG < 60 también en una determinación de hace ≥ 90 días (${priorLow.length} previa[s]): cronicidad compatible con ERC`}
   :prior90.length>0?{status:"NOT_CONFIRMED",note:"Hay creatininas previas de hace ≥ 90 días con TFG ≥ 60: la reducción actual es reciente — descartar lesión renal aguda antes de estadificar"}
   :{status:"NOT_CONFIRMED",note:"No hay creatinina de hace ≥ 90 días: no se puede afirmar cronicidad (ERC) ni descartar lesión renal aguda"};
  const uacr=await latestAnalyteReading(tctx,patientId,"UACR");
  const albuminuria=uacr&&Number.isFinite(uacr.value)?{category:uacr.value<30?"A1":uacr.value<300?"A2":"A3",uacrMgG:uacr.value,occurredAt:uacr.occurredAt,note:"UACR en mg/g (unidad asumida: el analito UACR aún no tiene especificación de unidad)"}:{category:null,note:"Sin albuminuria (UACR) registrada: la categoría A de KDIGO no se puede asignar"};
  return NextResponse.json({patientId,computable:true,ageYears:age,creatinineMgDl:scr,egfr:r.egfr,
   gCategory:r.stage,gLabel:r.label,
   // `stage` solo se afirma como estadio de ERC cuando la cronicidad está confirmada; si no, es una categoría G puntual.
   stage:chronicity.status==="CONFIRMED"?r.stage:null,
   chronicity,albuminuria,
   caveat:chronicity.status==="CONFIRMED"?"Categoría G con cronicidad documentada; la categoría A depende de la albuminuria.":"Categoría G PUNTUAL: no confirma ERC ni descarta lesión renal aguda.",
   algorithm:{id:"CKD-EPI-2021",version:"1",staging:"KDIGO-2012 (G por TFG; cronicidad ≥ 90 días; A por UACR)"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
