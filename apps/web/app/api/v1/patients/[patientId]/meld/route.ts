import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{meldScore}from"../../../../../../../../packages/meld/src";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BW — GET /api/v1/patients/:id/meld (pronóstico de hepatopatía avanzada: bilirrubina + INR + creatinina)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  // Entradas VERIFICADAS y de un mismo periodo (antes podían mezclarse una bilirrubina de hoy con un INR de hace meses).
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"BILIRUBIN",maxAgeDays:MAX_AGE_DAYS.MELD},{analyte:"INR",maxAgeDays:MAX_AGE_DAYS.MELD},{analyte:"CREATININE",maxAgeDays:MAX_AGE_DAYS.MELD}],{coherenceHours:COHERENCE_HOURS.MELD});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  const bili=inp.values["BILIRUBIN"],inr=inp.values["INR"],creat=inp.values["CREATININE"];
  const r=meldScore(bili!,inr!,creat!);
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,meld:r.score,risk:r.risk,mortality90d:r.mortality90d,
   // MELD clásico (UNOS 2002). NO es el MELD-Na ni el MELD 3.0 usados hoy para asignación de trasplante, y no recibe
   // el dato de diálisis (≥2 sesiones/semana ⇒ creatinina = 4.0): en un paciente en diálisis SUBESTIMA el puntaje.
   caveat:"MELD clásico: no es MELD-Na/MELD 3.0 y no considera diálisis (subestima en pacientes en terapia de reemplazo renal).",
   algorithm:{id:"MELD-UNOS-2002",version:"1"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
