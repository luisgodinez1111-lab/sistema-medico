import{latestAnalyteReading,type AnalyteReading}from"./clinical-runtime";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{normalizeLabValue,analyteLabel}from"../../../packages/lab-reference/src";
// Auditoría 2026-09-19 (C-01, C-02, C-11, C-12) — ENTRADAS VERIFICADAS para las calculadoras clínicas.
//
// Antes, cada calculadora pedía "el último número" de cada analito y calculaba: sin unidad, sin fecha, sin
// comprobar que los valores vinieran de la misma extracción. De ahí: FIB-4 = 0.00 con plaquetas en /µL, un
// pH de hoy combinado con una pCO₂ de la semana pasada, o un eGFR con una creatinina de hace tres años.
//
// Esta guarda es el ÚNICO camino por el que una calculadora obtiene datos de laboratorio. Para cada analito:
//   1) existe (si no: NOT_COMPUTABLE · faltante);
//   2) es numérico y PLAUSIBLE en la unidad canónica (atrapa cruces SI↔convencional en eventos sin unidad);
//   3) no está OBSOLETO (antigüedad máxima por analito, declarada por quien calcula);
//   4) en scores multi-analito, todos caen en una VENTANA de coherencia (misma muestra o N horas).
// Si algo falla, la respuesta es un "no computable" con el motivo — nunca un número.
export type AnalyteSpec=Readonly<{analyte:string;maxAgeDays:number}>;
export type VerifiedInput=Readonly<{analyte:string;value:number;unit:string|null;unitAssumed:boolean;occurredAt:string;ageDays:number;resultId:string;specimenId:string|null}>;
export type AnalyteInputs=
 |Readonly<{ok:true;values:Readonly<Record<string,number>>;inputs:readonly VerifiedInput[];warnings:readonly string[]}>
 |Readonly<{ok:false;reason:string;missing:readonly string[];stale:readonly string[];implausible:readonly string[]}>;
const DAY_MS=86_400_000;
export type ReadOptions=Readonly<{coherenceHours?:number;now?:Date}>;

// Núcleo PURO (testeable sin base de datos): decide sobre lecturas ya obtenidas.
export function verifyAnalyteReadings(specs:readonly AnalyteSpec[],readings:readonly(AnalyteReading|undefined)[],opts:ReadOptions={}):AnalyteInputs{
 const now=(opts.now??new Date()).getTime();
 const missing:string[]=[],missingLabels:string[]=[],stale:string[]=[],implausible:string[]=[],inputs:VerifiedInput[]=[],warnings:string[]=[];
 specs.forEach((s,i)=>{
  const r=readings[i];const label=analyteLabel(s.analyte); // nombre clínico en los mensajes; el código va en `missing`
  if(!r){missing.push(s.analyte);missingLabels.push(label);return;}
  // La plausibilidad se revalida SIEMPRE sobre el valor canónico (los eventos antiguos no pasaron por ella).
  const n=normalizeLabValue(s.analyte,r.value);
  if(!n.ok){implausible.push(`${label} (${n.message})`);return;}
  const ageDays=Math.floor((now-new Date(r.occurredAt).getTime())/DAY_MS);
  if(ageDays>s.maxAgeDays){stale.push(`${label} de hace ${ageDays} días (máx. ${s.maxAgeDays})`);return;}
  if(r.unitAssumed)warnings.push(`${label}: el resultado se registró SIN unidad; se asumió ${n.canonicalUnit??"la unidad canónica"}.`);
  inputs.push({analyte:s.analyte,value:n.canonicalValue,unit:r.canonicalUnit??n.canonicalUnit,unitAssumed:r.unitAssumed,occurredAt:r.occurredAt,ageDays,resultId:r.resultId,specimenId:r.specimenId});
 });
 if(missing.length||stale.length||implausible.length){
  const parts=[missing.length?`Requiere ${missingLabels.join(" + ")}`:"",stale.length?`Dato obsoleto: ${stale.join("; ")}`:"",implausible.length?`Valor no utilizable: ${implausible.join("; ")}`:""].filter(Boolean);
  return{ok:false,reason:parts.join(" · "),missing,stale,implausible};
 }
 // Coherencia temporal: un score multi-analito solo es válido si sus entradas describen el MISMO momento clínico.
 if(opts.coherenceHours!==undefined&&inputs.length>1){
  const sameSpecimen=inputs.every(x=>x.specimenId!==null&&x.specimenId===inputs[0]!.specimenId);
  const times=inputs.map(x=>new Date(x.occurredAt).getTime());const spreadH=(Math.max(...times)-Math.min(...times))/3_600_000;
  if(!sameSpecimen&&spreadH>opts.coherenceHours)return{ok:false,reason:`Los analitos provienen de extracciones distintas (${spreadH.toFixed(1)} h entre la más antigua y la más reciente; máximo ${opts.coherenceHours} h). Se requiere la misma muestra.`,missing:[],stale:[],implausible:[]};
 }
 return{ok:true,values:Object.fromEntries(inputs.map(x=>[x.analyte,x.value])),inputs,warnings};
}
export async function readAnalyteInputs(ctx:HttpTenantContext,patientId:string,specs:readonly AnalyteSpec[],opts:ReadOptions={}):Promise<AnalyteInputs>{
 const readings=await Promise.all(specs.map(s=>latestAnalyteReading(ctx,patientId,s.analyte)));
 return verifyAnalyteReadings(specs,readings,opts);
}
// Antigüedad máxima por uso (días). Criterio conservador de ingeniería, PENDIENTE de validación clínica:
// una creatinina de más de un año no describe la función renal actual; una gasometría vale horas, no días.
export const MAX_AGE_DAYS={RENAL_FUNCTION:365,GLYCEMIC_CONTROL:365,ANTICOAGULATION:30,LIVER_PANEL:180,MELD:30,BLOOD_GAS:1,METABOLIC_PANEL:7,ACUTE_INFECTION:2}as const;
// Ventana de coherencia (horas) entre analitos de un mismo score cuando no comparten `specimenId`. UNA sola fuente:
// la ruta de cada calculadora y el panel de inteligencia clínica usan exactamente la misma ventana.
export const COHERENCE_HOURS={BLOOD_GAS:1,METABOLIC_PANEL:24,MELD:24*7,LIVER_PANEL:24*30}as const;
// Lectura verificada "todo o nada" para quien solo necesita los valores (paneles resumen): si CUALQUIER entrada
// falta, es obsoleta, implausible o incoherente, devuelve undefined y el hallazgo derivado NO se emite.
export async function verifiedValues(ctx:HttpTenantContext,patientId:string,analytes:readonly string[],maxAgeDays:number,coherenceHours?:number):Promise<Readonly<Record<string,number>>|undefined>{
 const r=await readAnalyteInputs(ctx,patientId,analytes.map(analyte=>({analyte,maxAgeDays})),coherenceHours!==undefined?{coherenceHours}:{});
 return r.ok?r.values:undefined;
}
// Cuerpo ESTRUCTURADO del "no computable": además del texto para el médico, los códigos de analito faltantes/obsoletos/
// implausibles, para que ningún cliente tenga que interpretar una frase.
export function notComputable(inp:Extract<AnalyteInputs,{ok:false}>){return{reason:inp.reason,missing:inp.missing,stale:inp.stale,implausible:inp.implausible};}
// Procedencia que TODA calculadora devuelve junto al resultado: con qué datos (y de cuándo) se calculó.
export function provenance(inputs:readonly VerifiedInput[]){return inputs.map(x=>({analyte:x.analyte,value:x.value,unit:x.unit,unitAssumed:x.unitAssumed,occurredAt:x.occurredAt,ageDays:x.ageDays,resultId:x.resultId}));}
