import{NextResponse}from"next/server";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{listPatients,claimsRegistry,problemRegistry}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
// EPIC AD/UI — GET /api/v1/reports -> tablero analítico del consultorio (vista Reportes).
// Compone métricas REALES donde hay fuente única: pacientes atendidos (padrón), ingresos totales (facturas
// pagadas) y diagnósticos principales (registro de problemas, top por CIE-10). El resto del tablero (calidad,
// origen, comparativo) se muestra representativo en la UI. Determinista, sin escritura, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"record:export",purpose:"TREATMENT"});
  const[patients,claimRows,problemRows]=await Promise.all([
   listPatients(ctx),
   claimsRegistry(ctx),
   problemRegistry(ctx),
  ]);
  const income=Math.round(claimRows.filter(c=>c.status==="PAID").reduce((s,c)=>{const n=parseFloat(String(c.amount).replace(/[^0-9.]/g,""));return s+(Number.isFinite(n)?n:0);},0)*100)/100;
  // Diagnósticos principales por CIE-10 (top 5).
  const byCode=new Map<string,{code:string;description:string;count:number}>();
  for(const p of problemRows){const k=p.code;const e=byCode.get(k)??{code:p.code,description:p.description,count:0};e.count++;byCode.set(k,e);}
  const totalDx=problemRows.length||1;
  const topDiagnoses=[...byCode.values()].sort((a,b)=>b.count-a.count).slice(0,5).map(e=>({code:e.code,description:e.description,count:e.count,pct:Math.round(e.count/totalDx*100)}));
  return NextResponse.json({
   patientsAttended:patients.length,
   income,
   diagnosesTotal:problemRows.length,
   topDiagnoses,
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
