import{parseBp}from"../../../../../../../../packages/bp-staging/src";
import{bmiFromVitals}from"../../../../../../../../packages/anthropometrics/src";
import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{patientVitals,type VitalPoint}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom,pathIds}from"../../../../../../lib/http-command";
// EPIC W/UI — GET /api/v1/patients/:id/vitals  (vista Signos vitales: Últimos registros + Tendencias)
// Agrupa los puntos VITAL_RECORDED por toma (mismo occurredAt) en filas TA/FC/FR/Temp/SpO2/Peso/Talla/IMC,
// deriva IMC (peso/talla²) y las series de tendencia (TA sistólica, FC, Peso, IMC). Determinista, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const FIELD:Record<string,string>={BP:"ta",HR:"fc",RESP:"fr",TEMP:"temp",SPO2:"spo2",WEIGHT:"peso",HEIGHT:"talla"};
// C-21: IMC y sistólica por las implementaciones únicas (packages/anthropometrics, packages/bp-staging).
const imcOf=(peso:string|undefined,talla:string|undefined,tallaUnit:string|undefined)=>bmiFromVitals({value:peso},{value:talla,unit:tallaUnit})?.bmi??null;
const sys=(ta:string):number|null=>parseBp(ta)?.systolic??null;
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await pathIds(ctx.params);
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"patient:read",purpose:"TREATMENT"});
  const points=await patientVitals(tctx,patientId);
  // Agrupar por toma (occurredAt). Cada toma reúne los tipos con el mismo timestamp.
  const byAt=new Map<string,Record<string,string>>();
  for(const p of points as VitalPoint[]){const key=p.at;const g=byAt.get(key)??{};const f=FIELD[p.vitalType];if(f){g[f]=p.value;if(f==="talla")g["tallaUnit"]=p.unit;}byAt.set(key,g);}
  const ats=[...byAt.keys()].sort((a,b)=>b.localeCompare(a)); // desc
  const records=ats.map(at=>{const g=byAt.get(at)!;const imc=imcOf(g.peso,g.talla,g.tallaUnit);
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
