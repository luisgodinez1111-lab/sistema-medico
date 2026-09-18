import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{patientVitals,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC W/UI — GET /api/v1/patients/:id/vitals  (vista Signos vitales: Últimos registros + Tendencias)
// Agrupa los puntos VITAL_RECORDED por toma (mismo occurredAt) en filas TA/FC/FR/Temp/SpO2/Peso/Talla/IMC,
// deriva IMC (peso/talla²) y las series de tendencia (TA sistólica, FC, Peso, IMC). Determinista, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const FIELD:Record<string,string>={BP:"ta",HR:"fc",RESP:"fr",TEMP:"temp",SPO2:"spo2",WEIGHT:"peso",HEIGHT:"talla"};
function imcOf(pesoKg:number,tallaCm:number):number|null{if(!pesoKg||!tallaCm)return null;const m=tallaCm/100;return Math.round(pesoKg/(m*m)*10)/10;}
function sys(ta:string):number|null{const m=/^(\d+)\s*\/\s*\d+/.exec(ta.trim());return m?Number(m[1]):null;}
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
  const points=await patientVitals(tctx,patientId);
  // Agrupar por toma (occurredAt). Cada toma reúne los tipos con el mismo timestamp.
  const byAt=new Map<string,Record<string,string>>();
  for(const p of points as VitalPoint[]){const key=p.at;const g=byAt.get(key)??{};const f=FIELD[p.vitalType];if(f)g[f]=p.value;byAt.set(key,g);}
  const ats=[...byAt.keys()].sort((a,b)=>b.localeCompare(a)); // desc
  const records=ats.map(at=>{const g=byAt.get(at)!;const peso=Number(g.peso??0),talla=Number(g.talla??0);const imc=imcOf(peso,talla);
   return{at,ta:g.ta??"",fc:g.fc??"",fr:g.fr??"",temp:g.temp??"",spo2:g.spo2??"",peso:g.peso??"",talla:g.talla??"",imc:imc!==null?String(imc):""};});
  // Series de tendencia (ascendente por fecha) para las tarjetas
  const asc=[...records].reverse();
  const series={
   BP:asc.filter(r=>sys(r.ta)!==null).map(r=>({value:sys(r.ta)!,at:r.at})),
   HR:asc.filter(r=>r.fc).map(r=>({value:Number(r.fc),at:r.at})),
   WEIGHT:asc.filter(r=>r.peso).map(r=>({value:Number(r.peso),at:r.at})),
   IMC:asc.filter(r=>r.imc).map(r=>({value:Number(r.imc),at:r.at})),
  };
  const latest=records[0]??null;
  return NextResponse.json({records,series,latest,count:records.length},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
