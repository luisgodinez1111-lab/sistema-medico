// EPIC BK — Pronóstico de vacunación por edad (Cartilla Nacional de Salud de México; subconjunto). Puro, sin PHI.
//
// Auditoría 2026-09-19 (C-10): el pronóstico pediátrico se aplicaba a CUALQUIER edad: un adulto de 40 años sin registros
// tenía "15 vacunas vencidas", el rotavirus aparecía vencido a los 3 años (contraindicado pasada la lactancia) y un
// adolescente figuraba "completo" sin VPH. Ahora cada dosis tiene una VENTANA de aplicabilidad [ageMonths, maxAgeMonths):
//   · antes de la ventana: UPCOMING; dentro: DUE/OVERDUE; pasada la ventana sin aplicar: NOT_APPLICABLE (ya no procede o
//     requiere criterio médico individual; NO cuenta como vencida);
//   · dosis del adolescente y del adulto (VPH, Td, influenza y neumococo del adulto mayor) con sus propias ventanas;
//   · las dosis ANUALES (influenza) se evalúan por la fecha de la última aplicación, no por conteo.
// Referencia orientativa: Cartilla Nacional de Salud (SSA) y esquemas OMS. PENDIENTE de validación por un médico.
export type ScheduleEntry=Readonly<{code:string;ageMonths:number;maxAgeMonths:number;annual?:boolean;label:string}>;
const M=(years:number)=>years*12;
export const SCHEDULE:readonly ScheduleEntry[]=[
 {code:"BCG",ageMonths:0,maxAgeMonths:M(5),label:"BCG"},
 {code:"HEPB",ageMonths:0,maxAgeMonths:M(19),label:"Hepatitis B (1)"},
 {code:"HEPB",ageMonths:2,maxAgeMonths:M(19),label:"Hepatitis B (2)"},
 {code:"HEPB",ageMonths:6,maxAgeMonths:M(19),label:"Hepatitis B (3)"},
 {code:"PENTA",ageMonths:2,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (1)"},
 {code:"PENTA",ageMonths:4,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (2)"},
 {code:"PENTA",ageMonths:6,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (3)"},
 {code:"PENTA",ageMonths:18,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (refuerzo)"},
 {code:"ROTA",ageMonths:2,maxAgeMonths:8,label:"Rotavirus (1)"},   // OMS: no iniciar después de las 15 semanas ni completar después de los 8 meses
 {code:"ROTA",ageMonths:4,maxAgeMonths:8,label:"Rotavirus (2)"},
 {code:"NEUMO",ageMonths:2,maxAgeMonths:M(5),label:"Neumococo conjugada (1)"},
 {code:"NEUMO",ageMonths:4,maxAgeMonths:M(5),label:"Neumococo conjugada (2)"},
 {code:"NEUMO",ageMonths:12,maxAgeMonths:M(5),label:"Neumococo conjugada (refuerzo)"},
 {code:"SRP",ageMonths:12,maxAgeMonths:M(40),label:"SRP (1)"},    // sarampión-rubéola: recuperación hasta los 39 años
 {code:"SRP",ageMonths:18,maxAgeMonths:M(40),label:"SRP (2)"},
 {code:"DPT",ageMonths:48,maxAgeMonths:M(7),label:"DPT (refuerzo 4 años)"},
 {code:"VPH",ageMonths:M(11),maxAgeMonths:M(27),label:"Virus del papiloma humano"}, // 11 años; recuperación hasta los 26
 {code:"TD",ageMonths:M(15),maxAgeMonths:Infinity,annual:false,label:"Td (tétanos-difteria)"}, // adolescente/adulto: refuerzo cada 10 años (ver TD_INTERVAL)
 {code:"INFLUENZA",ageMonths:6,maxAgeMonths:M(5),annual:true,label:"Influenza anual (6–59 meses)"},
 {code:"INFLUENZA",ageMonths:M(60),maxAgeMonths:Infinity,annual:true,label:"Influenza anual (60 años y más)"},
 {code:"NEUMO23",ageMonths:M(60),maxAgeMonths:Infinity,label:"Neumococo polisacárida (60 años y más)"},
];
export const TD_INTERVAL_MONTHS=M(10);
// Edad en meses entre dos fechas ISO (calendario, ajustando por día del mes). >=0.
export function ageInMonths(birthDate:string,asOf:string):number{
 const b=new Date(birthDate),a=new Date(asOf);
 if(Number.isNaN(b.getTime())||Number.isNaN(a.getTime()))return NaN;
 let m=(a.getUTCFullYear()-b.getUTCFullYear())*12+(a.getUTCMonth()-b.getUTCMonth());
 if(a.getUTCDate()<b.getUTCDate())m-=1;
 return Math.max(0,m);
}
export type ForecastStatus="COMPLETE"|"OVERDUE"|"DUE"|"UPCOMING"|"NOT_APPLICABLE";
export type ForecastDose=Readonly<{code:string;label:string;doseNumber:number;recommendedAgeMonths:number;maxAgeMonths:number|null;status:ForecastStatus;note?:string}>;
export type AdministeredDose=Readonly<{code:string;occurredAt?:string|null}>;
function normalizeAdministered(items:readonly(string|AdministeredDose)[]):AdministeredDose[]{return items.map(x=>typeof x==="string"?{code:x.trim().toUpperCase()}:{code:x.code.trim().toUpperCase(),occurredAt:x.occurredAt??null});}
const monthsBetween=(fromIso:string,toIso:string)=>ageInMonths(fromIso,toIso);
// Pronóstico: por cada dosis del esquema, su estado según la edad, la ventana de aplicabilidad y lo aplicado.
// graceMonths: ventana antes de considerar OVERDUE (por defecto 1 mes).
export function forecastImmunizations(birthDate:string,administered:readonly(string|AdministeredDose)[],asOf:string,graceMonths=1):ForecastDose[]{
 const age=ageInMonths(birthDate,asOf);
 if(Number.isNaN(age))return[];
 const doses=normalizeAdministered(administered);
 const countByCode=new Map<string,number>();for(const d of doses)countByCode.set(d.code,(countByCode.get(d.code)??0)+1);
 const lastByCode=new Map<string,string>();for(const d of doses)if(d.occurredAt&&(!lastByCode.has(d.code)||d.occurredAt>lastByCode.get(d.code)!))lastByCode.set(d.code,d.occurredAt);
 const used=new Map<string,number>();
 const out:ForecastDose[]=[];
 for(const e of SCHEDULE){
  const code=e.code;const doseNumber=(used.get(code)??0)+1;used.set(code,doseNumber);
  const applicable=age<e.maxAgeMonths;
  const base={code,label:e.label,doseNumber,recommendedAgeMonths:e.ageMonths,maxAgeMonths:Number.isFinite(e.maxAgeMonths)?e.maxAgeMonths:null};
  if(e.annual||code==="TD"){
   // Dosis periódicas: se decide por la FECHA de la última aplicación, no por conteo.
   const interval=code==="TD"?TD_INTERVAL_MONTHS:12;
   if(age<e.ageMonths){out.push({...base,status:"UPCOMING"});continue;}
   if(!applicable){out.push({...base,status:"NOT_APPLICABLE",note:"Fuera del grupo de edad de esta indicación"});continue;}
   const last=lastByCode.get(code);
   if(last){const since=monthsBetween(last,asOf);out.push({...base,status:since<interval?"COMPLETE":since>interval+graceMonths?"OVERDUE":"DUE",note:`Última dosis hace ${since} meses; intervalo ${interval} meses`});continue;}
   if((countByCode.get(code)??0)>0){out.push({...base,status:"DUE",note:"Hay dosis registradas sin fecha: no se puede saber si el intervalo venció"});continue;}
   // Sin NINGÚN registro de esta dosis periódica: ausencia de dato ≠ no vacunado (Explicit Uncertainty). Se señala como
   // pendiente de VERIFICAR (DUE con nota), nunca como "vencida" (el antecedente suele no estar en el expediente).
   out.push({...base,status:"DUE",note:"Sin registro de dosis previas: verificar antecedente antes de darla por vencida"});continue;
  }
  const appliedForCode=countByCode.get(code)??0;
  let status:ForecastStatus;let note:string|undefined;
  if(doseNumber<=appliedForCode)status="COMPLETE";                        // ya aplicada (por conteo posicional)
  else if(age<e.ageMonths)status="UPCOMING";                               // aún no toca
  else if(!applicable){status="NOT_APPLICABLE";note=code==="ROTA"?"Rotavirus no se inicia ni completa pasados los 8 meses (contraindicado)":"Ventana de aplicación superada; la recuperación, si procede, es decisión médica individual";}
  else if(age>=M(18)&&appliedForCode===0){status="DUE";note="Sin registro de dosis previas: verificar antecedente antes de darla por vencida";} // ADULTO sin ningún registro del código: ausencia de dato ≠ no vacunado; en menores la recuperación sí se marca vencida
  else status=age>e.ageMonths+graceMonths?"OVERDUE":"DUE";                 // toca; DUE dentro de la gracia, OVERDUE fuera
  out.push(note!==undefined?{...base,status,note}:{...base,status});
 }
 return out;
}
// Resumen para priorización: cuántas OVERDUE / DUE (las NOT_APPLICABLE no cuentan como pendientes).
export function forecastSummary(doses:readonly ForecastDose[]){
 return{overdue:doses.filter(d=>d.status==="OVERDUE").length,due:doses.filter(d=>d.status==="DUE").length,upcoming:doses.filter(d=>d.status==="UPCOMING").length,complete:doses.filter(d=>d.status==="COMPLETE").length,notApplicable:doses.filter(d=>d.status==="NOT_APPLICABLE").length};
}
