import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{interpretAcidBase}from"../../../../../../../../packages/acid-base/src";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
import{assertRouteIds}from"../../../../../../lib/http/endpoint";
// EPIC BX — GET /api/v1/patients/:id/acid-base (interpretación de gasometría: trastorno primario + Winters)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  assertRouteIds({patientId}); // D8: id con formato inválido -> 404, sin tocar la base
  // Una gasometría es un conjunto SIMULTÁNEO: pH, pCO₂ y HCO₃ deben venir de la misma muestra (o ≤1 h) y ser recientes.
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"PH",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS},{analyte:"PCO2",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS},{analyte:"BICARBONATE",maxAgeDays:MAX_AGE_DAYS.BLOOD_GAS}],{coherenceHours:COHERENCE_HOURS.BLOOD_GAS});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  const ph=inp.values["PH"],pco2=inp.values["PCO2"],hco3=inp.values["BICARBONATE"];
  const r=interpretAcidBase(ph!,pco2!,hco3!);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,ph,pco2,hco3,status:r.status,primary:r.primary,expectedPco2:r.expectedPco2??null,compensation:r.compensation??null,interpretation:r.interpretation,
   caveat:"Solo verifica la compensación de la acidosis metabólica (Winters); los otros tres trastornos primarios no se comprueban. Sin brecha aniónica corregida por albúmina ni delta-delta.",
   algorithm:{id:"ACID-BASE-WINTERS",version:"1"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
