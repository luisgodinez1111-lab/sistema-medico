import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{checkInteractionSet,SEVERITY_LABEL,resolveDrug,resolveFactor}from"../../../../../../packages/drug-catalog/src";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC BN — POST /api/v1/interactions  (Medicamentos › pestaña "Interacciones", verificador de conjunto)
// Evalúa TODO un conjunto de fármacos entre sí MÁS factores del paciente (alcohol, insuficiencia renal,
// embarazo…). Determinista, sin PHI, sin escritura. Devuelve cada hallazgo con severidad de 4 niveles
// (Contraindicada/Mayor/Moderada/Menor) + mecanismo + recomendación, ordenados de mayor a menor severidad.
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(req:Request){
 try{
  const{claims}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"medication:propose",purpose:"TREATMENT"});
  const body=await req.json().catch(()=>({}));
  const drugs=Array.isArray(body.drugs)?body.drugs.map((d:unknown)=>String(d??"").trim()).filter(Boolean):[];
  const factors=Array.isArray(body.factors)?body.factors.map((f:unknown)=>String(f??"").trim()).filter(Boolean):[];
  const result=checkInteractionSet(drugs,factors);
  // Etiquetas en español + eco de lo que resolvió el catálogo (transparencia clínica).
  const findings=result.findings.map(f=>({...f,severityLabel:SEVERITY_LABEL[f.severity]}));
  const resolvedDrugs=drugs.map(code=>{const r=resolveDrug(code);return{input:code,ingredient:r?.ingredient??null,classes:r?.classes??[]};});
  const resolvedFactors=factors.map(label=>{const c=resolveFactor(label);return{input:label,code:c??null};});
  return NextResponse.json({
   findings,
   counts:result.counts,
   highestSeverity:result.highestSeverity,
   highestSeverityLabel:result.highestSeverity?SEVERITY_LABEL[result.highestSeverity]:null,
   resolvedDrugs,resolvedFactors,
   unresolvedDrugs:result.unresolvedDrugs,
   unresolvedFactors:result.unresolvedFactors,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
