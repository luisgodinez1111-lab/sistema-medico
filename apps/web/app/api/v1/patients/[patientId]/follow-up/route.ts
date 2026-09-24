import{parseBp}from"../../../../../../../../packages/bp-staging/src";
import{bmiFromVitals}from"../../../../../../../../packages/anthropometrics/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{patientObligations,patientVitals,analyteSeries,problemRegistry,activeMedicationDrugCodes,activeAllergySubstances,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC BA/UI — GET /api/v1/patients/:id/follow-up  (vista Seguimiento, snapshot compuesto)
// Compone: Tareas de seguimiento (obligaciones), Tendencia de signos vitales (series+promedios) e
// Indicadores clave (HbA1c/LDL de labs, Peso/IMC de vitales, primero->último). Determinista, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const OBL_ES:Record<string,string>={OPEN:"Pendiente",IN_PROGRESS:"En progreso",COMPLETED:"Completada",CANCELLED:"Cancelada"};
const sys=(ta:string):number|null=>parseBp(ta)?.systolic??null; // C-21: parser único
function avg(ns:number[]):number|null{return ns.length?Math.round(ns.reduce((a,b)=>a+b,0)/ns.length):null;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"obligation:read",purpose:"TREATMENT"});
  const[tasks,points,hba1cS,ldlS,allProblems,meds,allergies]=await Promise.all([
   patientObligations(tctx,patientId),
   patientVitals(tctx,patientId),
   analyteSeries(tctx,patientId,"HBA1C"),
   analyteSeries(tctx,patientId,"LDL"),
   problemRegistry(tctx),
   activeMedicationDrugCodes(tctx,patientId),
   activeAllergySubstances(tctx,patientId),
  ]);
  // Agrupar vitales por toma (occurredAt) y construir series ascendentes.
  const byAt=new Map<string,Record<string,string>>();
  for(const p of points as VitalPoint[]){const g=byAt.get(p.at)??{};g[p.vitalType]=p.value;if(p.vitalType==="HEIGHT")g["HEIGHT_UNIT"]=p.unit;byAt.set(p.at,g);}
  const ats=[...byAt.keys()].sort();
  // La talla cambia poco: si en una toma no se midió, se usa la última conocida (con su unidad). IMC por la implementación única (C-21).
  let lastHeight:{value:string;unit:string|undefined}|undefined;for(const p of points as VitalPoint[]){if(p.vitalType==="HEIGHT")lastHeight={value:p.value,unit:p.unit};}
  const recs=ats.map(at=>{const g=byAt.get(at)!;const h=g.HEIGHT!==undefined?{value:g.HEIGHT,unit:g.HEIGHT_UNIT}:lastHeight;
   const imc=bmiFromVitals({value:g.WEIGHT},h)?.bmi??null;
   return{bp:g.BP?sys(g.BP):null,ta:g.BP??null,hr:g.HR?Number(g.HR):null,weight:g.WEIGHT?Number(g.WEIGHT):null,imc};});
  const bpS=recs.map(r=>r.bp).filter((x):x is number=>x!==null);
  const hrS=recs.map(r=>r.hr).filter((x):x is number=>x!==null);
  const wS=recs.map(r=>r.weight).filter((x):x is number=>x!==null);
  const imcS=recs.map(r=>r.imc).filter((x):x is number=>x!==null);
  const lastTa=[...recs].reverse().find(r=>r.ta)?.ta??null;
  const vitalsTrend={
   series:{BP:bpS,HR:hrS,WEIGHT:wS,IMC:imcS},
   avg:{ta:lastTa,bp:avg(bpS),hr:avg(hrS),weight:wS.length?wS[wS.length-1]:null,imc:imcS.length?imcS[imcS.length-1]:null},
  };
  const ind=(s:{value:number}[])=>s.length?{first:s[0]!.value,last:s[s.length-1]!.value}:null;
  const wFirst=wS.length?wS[0]!:null,wLast=wS.length?wS[wS.length-1]!:null;
  const indicators={
   hba1c:ind(hba1cS),ldl:ind(ldlS),
   weight:wFirst!==null&&wLast!==null?{first:wFirst,last:wLast}:null,
   imc:imcS.length?{first:imcS[0]!,last:imcS[imcS.length-1]!}:null,
  };
  const activeProblems=allProblems.filter(p=>p.patientId===patientId&&(p.status==="ACTIVE"||p.status==="CHRONIC")).length;
  return NextResponse.json({
   // Auditoría L-01: cada tarea declara si BLOQUEA la firma del encuentro y por qué (URGENT / OVERDUE / INVALID_DUE_DATE).
   tasks:tasks.map(t=>({obligationId:t.obligationId,task:t.task,dueAt:t.dueAt,status:t.status,statusLabel:OBL_ES[t.status]??"Pendiente",done:t.status==="COMPLETED",priority:t.priority,blocksSignature:t.blocksSignature})),
   vitalsTrend,indicators,
   counts:{problems:activeProblems,medications:meds.length,allergies:allergies.length},
  },{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
