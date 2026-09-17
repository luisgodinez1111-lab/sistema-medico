// EPIC BK — Pronóstico de vacunación por edad (cartilla nacional de México, subconjunto de demostración).
// PROFUNDIDAD del eje C: razonamiento TEMPORAL por edad — dado el nacimiento y las vacunas aplicadas,
// computa qué dosis están DUE/OVERDUE/UPCOMING/COMPLETE. Puro, sin PHI en el módulo (recibe fecha y códigos).
// El esquema oficial (Cartilla Nacional de Salud) se cargaría de la fuente autorizada.
export type ScheduleEntry=Readonly<{code:string;ageMonths:number}>;
// Esquema por código de vacuna y edad recomendada (meses). Cada aparición = una dosis de la serie.
const SCHEDULE:readonly ScheduleEntry[]=[
 {code:"BCG",ageMonths:0},
 {code:"HEPB",ageMonths:0},
 {code:"PENTA",ageMonths:2},{code:"PENTA",ageMonths:4},{code:"PENTA",ageMonths:6},{code:"PENTA",ageMonths:18},
 {code:"ROTA",ageMonths:2},{code:"ROTA",ageMonths:4},
 {code:"NEUMO",ageMonths:2},{code:"NEUMO",ageMonths:4},{code:"NEUMO",ageMonths:12},
 {code:"INFLUENZA",ageMonths:6},
 {code:"SRP",ageMonths:12},{code:"SRP",ageMonths:18},
 {code:"DPT",ageMonths:48},
];
// Edad en meses entre dos fechas ISO (calendario, ajustando por día del mes). >=0.
export function ageInMonths(birthDate:string,asOf:string):number{
 const b=new Date(birthDate),a=new Date(asOf);
 if(Number.isNaN(b.getTime())||Number.isNaN(a.getTime()))return NaN;
 let m=(a.getUTCFullYear()-b.getUTCFullYear())*12+(a.getUTCMonth()-b.getUTCMonth());
 if(a.getUTCDate()<b.getUTCDate())m-=1;
 return Math.max(0,m);
}
export type ForecastStatus="COMPLETE"|"OVERDUE"|"DUE"|"UPCOMING";
export type ForecastDose=Readonly<{code:string;doseNumber:number;recommendedAgeMonths:number;status:ForecastStatus}>;
// Cuenta de dosis aplicadas por código (a partir de los códigos de vacunas ADMINISTRADAS).
function counts(administeredCodes:readonly string[]):Map<string,number>{
 const m=new Map<string,number>();for(const c of administeredCodes){const k=c.trim().toUpperCase();m.set(k,(m.get(k)??0)+1);}return m;
}
// Pronóstico: por cada dosis del esquema, su estado según la edad y cuántas dosis de ese código ya se aplicaron.
// graceMonths: ventana antes de considerar OVERDUE (por defecto 1 mes).
export function forecastImmunizations(birthDate:string,administeredCodes:readonly string[],asOf:string,graceMonths=1):ForecastDose[]{
 const age=ageInMonths(birthDate,asOf);
 if(Number.isNaN(age))return[];
 const applied=counts(administeredCodes);const used=new Map<string,number>();
 const out:ForecastDose[]=[];
 for(const e of SCHEDULE){
  const code=e.code;const doseNumber=(used.get(code)??0)+1;used.set(code,doseNumber);
  const appliedForCode=applied.get(code)??0;
  let status:ForecastStatus;
  if(doseNumber<=appliedForCode)status="COMPLETE";                 // ya aplicada (por conteo posicional)
  else if(age<e.ageMonths)status="UPCOMING";                        // aún no toca
  else status=age>e.ageMonths+graceMonths?"OVERDUE":"DUE";          // toca; DUE dentro de la gracia, OVERDUE fuera
  out.push({code,doseNumber,recommendedAgeMonths:e.ageMonths,status});
 }
 return out;
}
// Resumen para priorización: cuántas OVERDUE / DUE.
export function forecastSummary(doses:readonly ForecastDose[]){
 return{overdue:doses.filter(d=>d.status==="OVERDUE").length,due:doses.filter(d=>d.status==="DUE").length,upcoming:doses.filter(d=>d.status==="UPCOMING").length,complete:doses.filter(d=>d.status==="COMPLETE").length};
}
