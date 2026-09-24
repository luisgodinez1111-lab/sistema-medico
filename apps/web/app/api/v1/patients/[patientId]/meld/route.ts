import{NextResponse}from"next/server";
import{calcReceipt,CLINICAL_USE_WARNING}from"../../../../../../lib/calc-receipt";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{meldScore}from"../../../../../../../../packages/meld/src";
import{readAnalyteInputs,provenance,MAX_AGE_DAYS,COHERENCE_HOURS,notComputable}from"../../../../../../lib/analyte-inputs";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// EPIC BW — GET /api/v1/patients/:id/meld (pronóstico de hepatopatía avanzada: bilirrubina + INR + creatinina)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  // Entradas VERIFICADAS y de un mismo periodo (antes podían mezclarse una bilirrubina de hoy con un INR de hace meses).
  const inp=await readAnalyteInputs(tctx,patientId,[{analyte:"BILIRUBIN",maxAgeDays:MAX_AGE_DAYS.MELD},{analyte:"INR",maxAgeDays:MAX_AGE_DAYS.MELD},{analyte:"CREATININE",maxAgeDays:MAX_AGE_DAYS.MELD}],{coherenceHours:COHERENCE_HOURS.MELD});
  if(!inp.ok)return NextResponse.json({patientId,computable:false,...notComputable(inp)},{status:200});
  const bili=inp.values["BILIRUBIN"],inr=inp.values["INR"],creat=inp.values["CREATININE"];
  // Auditoría C-19: la diálisis se DECLARA (?dialysis=true|false); sin declarar, el resultado lo dice y no asume.
  const q=new URL(req.url).searchParams.get("dialysis");const dialysis=q==="true"?true:q==="false"?false:undefined;
  const r=meldScore(bili!,inr!,creat!,{dialysis:dialysis===true});
  if(!r)return NextResponse.json({patientId,computable:false,reason:"Valores inválidos"},{status:200});
  return NextResponse.json({patientId,computable:true,meld:r.score,risk:r.risk,mortality90d:r.mortality90d,mortality90dPct:r.mortality90dPct,meldVersion:r.version,allocationNote:r.allocationNote,dialysis:dialysis??null,
   receipt:calcReceipt({id:"MELD",version:r.version,authority:"Kamath PS et al., Hepatology 2001; bandas de Wiesner 2003"},{dialysis:dialysis??false,inputs:provenance(inp.inputs),usageWarning:CLINICAL_USE_WARNING},"COMPUTED",r.score),
   // MELD clásico (UNOS 2002): pronóstico de gravedad. NO es el MELD-Na ni el MELD 3.0 que hoy asignan la prioridad de trasplante.
   caveat:dialysis===undefined?"MELD clásico (pronóstico; NO es el MELD-Na/MELD 3.0 de asignación de trasplante). Diálisis NO declarada: si el paciente recibe ≥2 sesiones/semana el puntaje real es mayor (declare ?dialysis=true).":"MELD clásico (pronóstico; NO es el MELD-Na/MELD 3.0 de asignación de trasplante).",
   algorithm:{id:"MELD-UNOS-2002",version:"1"},inputs:provenance(inp.inputs),warnings:inp.warnings},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
