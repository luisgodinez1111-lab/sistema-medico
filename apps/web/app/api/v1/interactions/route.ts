import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{checkInteractionSet,SEVERITY_LABEL,resolveDrug,resolveFactor}from"../../../../../../packages/drug-catalog/src";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom,parseJson}from"../../../../lib/http-command";
// EPIC BN — POST /api/v1/interactions  (Medicamentos › pestaña "Interacciones", verificador de conjunto)
// Evalúa TODO un conjunto de fármacos entre sí MÁS factores del paciente (alcohol, insuficiencia renal,
// embarazo…). Determinista, sin PHI, sin escritura. Devuelve cada hallazgo con severidad de 4 niveles
// (Contraindicada/Mayor/Moderada/Menor) + mecanismo + recomendación, ordenados de mayor a menor severidad.
export const runtime="nodejs";
export const dynamic="force-dynamic";

const Body=z.object({drugs:z.array(z.string().max(120)).max(60).default([]),factors:z.array(z.string().max(120)).max(30).default([])});
export async function POST(req:Request){
 try{
  const{claims}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"medication:propose",purpose:"TREATMENT"});
  // Validación de entrada con esquema (como el resto de rutas): listas acotadas de texto; nada de `any`.
  const body=await parseJson(req,Body);
  const clean=(xs:readonly string[]):string[]=>xs.map(x=>x.trim()).filter(Boolean);
  const drugs=clean(body.drugs),factors=clean(body.factors);
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
