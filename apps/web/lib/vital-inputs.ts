import{latestVitalReadings,type VitalReading}from"./clinical-runtime";
import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{normalizeVitalMeasure,canonicalVitalUnit}from"../../../packages/lab-reference/src";
// Auditoría 2026-09-19, anexo R03 (R03-11, R03-09, R03-18) — ENTRADAS VERIFICADAS de SIGNOS VITALES.
//
// Gemela de `analyte-inputs` (laboratorio), que ya existía. Los signos vitales no tenían equivalente: cada ruta hacía
// `Number(vitals["RESP"])` y calculaba. Lo que eso significaba en la práctica:
//   · una presión arterial de hace tres semanas decidía un ingreso hospitalario HOY (CURB-65, NEWS2);
//   · un peso en libras se trataba como kilogramos (IMC ×2.2);
//   · un valor implausible o mal capturado producía un puntaje BAJO en vez de un «no computable».
//
// Esta guarda es el único camino por el que un CÁLCULO obtiene signos vitales. Para cada tipo pedido:
//   1) existe y no está anulado (lo garantiza `latestVitalReadings`);
//   2) su unidad es reconocida y el valor se lleva a la unidad CANÓNICA (kg, cm, °C, mmHg, lpm, rpm, %);
//   3) es PLAUSIBLE en esa unidad;
//   4) no está OBSOLETO: cada uso declara su ventana (horas), porque la vigencia de una PA para decidir un ingreso no es
//      la de un peso para calcular el IMC.
// Si algo falla, la respuesta es un «no computable» con el motivo — nunca un número.
export type VitalSpec=Readonly<{vitalType:string;maxAgeHours:number}>;
export type VerifiedVital=Readonly<{vitalType:string;value:string;numericValue:number|undefined;unit:string;unitAssumed:boolean;occurredAt:string;ageHours:number;amended:boolean}>;
export type VitalInputs=
 |Readonly<{ok:true;values:Readonly<Record<string,string>>;inputs:readonly VerifiedVital[];warnings:readonly string[]}>
 |Readonly<{ok:false;reason:string;missing:readonly string[];stale:readonly string[];implausible:readonly string[]}>;
const HOUR_MS=3_600_000;
export type VitalReadOptions=Readonly<{now?:Date}>;
// Ventana de vigencia por uso (horas). Criterio de ingeniería explícito, PENDIENTE de validación clínica: una decisión de
// ingreso (CURB-65, NEWS2) se toma con la exploración de este turno, no con la de la semana pasada; el peso y la talla
// cambian en semanas, no en horas.
export const MAX_VITAL_AGE_HOURS={ACUTE_ADMISSION:8,ACUTE_ASSESSMENT:24,BP_STAGING:24*30,ANTHROPOMETRY:24*180}as const;
/** Etiqueta clínica de cada tipo, para que el mensaje al médico no diga «RESP». */
const LABEL:Readonly<Record<string,string>>={BP:"presión arterial",HR:"frecuencia cardiaca",RESP:"frecuencia respiratoria",TEMP:"temperatura",SPO2:"saturación de oxígeno",WEIGHT:"peso",HEIGHT:"talla"};
export function vitalLabel(t:string):string{return LABEL[t.trim().toUpperCase()]??t;}

// Núcleo PURO (testeable sin base de datos): decide sobre lecturas ya obtenidas.
export function verifyVitalReadings(specs:readonly VitalSpec[],readings:Readonly<Record<string,VitalReading|undefined>>,opts:VitalReadOptions={}):VitalInputs{
 const now=(opts.now??new Date()).getTime();
 const missing:string[]=[],missingLabels:string[]=[],stale:string[]=[],implausible:string[]=[],inputs:VerifiedVital[]=[],warnings:string[]=[];
 for(const s of specs){
  const t=s.vitalType.trim().toUpperCase();const label=vitalLabel(t);const r=readings[t];
  if(!r||r.value===""){missing.push(t);missingLabels.push(label);continue;}
  // La unidad se revalida SIEMPRE: los eventos anteriores a esta corrección no pasaron por la normalización.
  const unit=r.canonicalUnit??r.unit??canonicalVitalUnit(t)??null;
  const m=normalizeVitalMeasure(t,r.value,unit);
  if(!m.ok){implausible.push(`${label} (${m.message})`);continue;}
  const ageHours=(now-new Date(r.occurredAt).getTime())/HOUR_MS;
  if(ageHours>s.maxAgeHours){stale.push(`${label} de hace ${ageHours<48?`${Math.round(ageHours)} h`:`${Math.round(ageHours/24)} días`} (máx. ${s.maxAgeHours<48?`${s.maxAgeHours} h`:`${Math.round(s.maxAgeHours/24)} días`})`);continue;}
  if(r.unitAssumed)warnings.push(`${label}: la toma se registró antes de la normalización de unidades; se asumió ${m.canonicalUnit}.`);
  if(r.amended)warnings.push(`${label}: el valor vigente es una ENMIENDA de la toma original.`);
  const n=Number(m.canonicalValue);
  inputs.push({vitalType:t,value:m.canonicalValue,numericValue:Number.isFinite(n)?n:undefined,unit:m.canonicalUnit,unitAssumed:r.unitAssumed,occurredAt:r.occurredAt,ageHours:Math.round(ageHours*10)/10,amended:r.amended});
 }
 if(missing.length||stale.length||implausible.length){
  const parts=[missing.length?`Requiere ${missingLabels.join(" + ")}`:"",stale.length?`Dato obsoleto: ${stale.join("; ")}`:"",implausible.length?`Valor no utilizable: ${implausible.join("; ")}`:""].filter(Boolean);
  return{ok:false,reason:parts.join(" · "),missing,stale,implausible};
 }
 return{ok:true,values:Object.fromEntries(inputs.map(x=>[x.vitalType,x.value])),inputs,warnings};
}
export async function readVitalInputs(ctx:HttpTenantContext,patientId:string,specs:readonly VitalSpec[],opts:VitalReadOptions={}):Promise<VitalInputs>{
 return verifyVitalReadings(specs,await latestVitalReadings(ctx,patientId),opts);
}
/** Cuerpo ESTRUCTURADO del «no computable»: además del texto, los tipos faltantes/obsoletos/implausibles. */
export function vitalNotComputable(inp:Extract<VitalInputs,{ok:false}>){return{reason:inp.reason,missing:inp.missing,stale:inp.stale,implausible:inp.implausible};}
/** Procedencia que toda calculadora devuelve: con qué tomas (y de cuándo) se calculó. */
export function vitalProvenance(inputs:readonly VerifiedVital[]){return inputs.map(x=>({vitalType:x.vitalType,value:x.value,unit:x.unit,unitAssumed:x.unitAssumed,occurredAt:x.occurredAt,ageHours:x.ageHours,amended:x.amended}));}
