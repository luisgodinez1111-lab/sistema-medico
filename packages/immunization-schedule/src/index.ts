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
// Auditoría 2026-09-19, anexo R03 (R03-30): además de la ventana de aplicabilidad, cada dosis declara su EDAD MÍNIMA y
// el INTERVALO MÍNIMO respecto a la dosis anterior de la misma serie. Sin eso, el conteo era puramente posicional y tres
// pentavalentes puestas la misma semana se marcaban COMPLETE: exactamente lo que un pronóstico de vacunación existe para
// evitar. La lógica de ACIP/CDC consiste en validar edad e intervalo mínimos e INVALIDAR las dosis prematuras.
// `minAgeMonths` por omisión = `ageMonths` (la edad recomendada); `minIntervalMonths` por omisión = 1 mes (4 semanas),
// que es el intervalo mínimo general entre dosis de una misma serie primaria.
export type ScheduleEntry=Readonly<{code:string;ageMonths:number;maxAgeMonths:number;annual?:boolean;label:string;minAgeMonths?:number;minIntervalMonths?:number}>;
export const DEFAULT_MIN_INTERVAL_MONTHS=1;
const M=(years:number)=>years*12;
export const SCHEDULE:readonly ScheduleEntry[]=[
 {code:"BCG",ageMonths:0,maxAgeMonths:M(5),label:"BCG"},
 {code:"HEPB",ageMonths:0,maxAgeMonths:M(19),label:"Hepatitis B (1)"},
 {code:"HEPB",ageMonths:2,maxAgeMonths:M(19),label:"Hepatitis B (2)"},
 {code:"HEPB",ageMonths:6,maxAgeMonths:M(19),label:"Hepatitis B (3)",minAgeMonths:6,minIntervalMonths:2},
 {code:"PENTA",ageMonths:2,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (1)"},
 {code:"PENTA",ageMonths:4,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (2)"},
 {code:"PENTA",ageMonths:6,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (3)"},
 {code:"PENTA",ageMonths:18,maxAgeMonths:M(5),label:"Pentavalente/hexavalente (refuerzo)",minAgeMonths:12,minIntervalMonths:6},
 {code:"ROTA",ageMonths:2,maxAgeMonths:8,label:"Rotavirus (1)"},   // OMS: no iniciar después de las 15 semanas ni completar después de los 8 meses
 {code:"ROTA",ageMonths:4,maxAgeMonths:8,label:"Rotavirus (2)"},
 {code:"NEUMO",ageMonths:2,maxAgeMonths:M(5),label:"Neumococo conjugada (1)"},
 {code:"NEUMO",ageMonths:4,maxAgeMonths:M(5),label:"Neumococo conjugada (2)"},
 {code:"NEUMO",ageMonths:12,maxAgeMonths:M(5),label:"Neumococo conjugada (refuerzo)",minAgeMonths:12,minIntervalMonths:2},
 {code:"SRP",ageMonths:12,maxAgeMonths:M(40),label:"SRP (1)"},    // sarampión-rubéola: recuperación hasta los 39 años
 {code:"SRP",ageMonths:18,maxAgeMonths:M(40),label:"SRP (2)",minIntervalMonths:1},
 {code:"DPT",ageMonths:48,maxAgeMonths:M(7),label:"DPT (refuerzo 4 años)"},
 {code:"VPH",ageMonths:M(11),maxAgeMonths:M(27),label:"Virus del papiloma humano",minAgeMonths:M(9)}, // 11 años; recuperación hasta los 26
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
/**
 * R03-30: una dosis APLICADA que no cumple la edad mínima o el intervalo mínimo NO cuenta para la serie. Se informa
 * aparte (no se borra del expediente: se declara inválida para el pronóstico, con el motivo y lo que falta).
 */
export type InvalidatedDose=Readonly<{code:string;doseNumber:number;occurredAt:string;reasonCode:"BELOW_MIN_AGE"|"BELOW_MIN_INTERVAL";detail:string}>;
export type ForecastDose=Readonly<{code:string;label:string;doseNumber:number;recommendedAgeMonths:number;maxAgeMonths:number|null;status:ForecastStatus;note?:string}>;
export type AdministeredDose=Readonly<{code:string;occurredAt?:string|null}>;
/** Resultado completo del pronóstico: las dosis del esquema, las aplicadas que se invalidaron y por qué. */
export type Forecast=
 |Readonly<{ok:true;doses:readonly ForecastDose[];invalidated:readonly InvalidatedDose[];ageMonths:number}>
 |Readonly<{ok:false;reasonCode:"INVALID_BIRTH_DATE";detail:string}>;
function normalizeAdministered(items:readonly(string|AdministeredDose)[]):AdministeredDose[]{return items.map(x=>typeof x==="string"?{code:x.trim().toUpperCase()}:{code:x.code.trim().toUpperCase(),occurredAt:x.occurredAt??null});}
const monthsBetween=(fromIso:string,toIso:string)=>ageInMonths(fromIso,toIso);
/**
 * Valida las dosis aplicadas de cada código contra la serie del esquema: edad mínima e intervalo mínimo respecto a la
 * ANTERIOR VÁLIDA. Las dosis SIN fecha no se pueden validar: cuentan (no se castiga la falta de registro) y el
 * pronóstico lo declara en la nota de la dosis correspondiente.
 */
export function validateAdministered(birthDate:string,doses:readonly AdministeredDose[]):{validCountByCode:Map<string,number>;invalidated:InvalidatedDose[]}{
 const seriePorCodigo=new Map<string,ScheduleEntry[]>();
 for(const e of SCHEDULE){const l=seriePorCodigo.get(e.code)??[];l.push(e);seriePorCodigo.set(e.code,l);}
 const validCountByCode=new Map<string,number>();const invalidated:InvalidatedDose[]=[];
 const porCodigo=new Map<string,AdministeredDose[]>();
 for(const d of doses){const l=porCodigo.get(d.code)??[];l.push(d);porCodigo.set(d.code,l);}
 for(const[code,aplicadas]of porCodigo){
  const serie=seriePorCodigo.get(code);
  // Código fuera del esquema (o serie anual): no hay posición ni intervalo que validar.
  if(!serie||serie[0]?.annual||code==="TD"){validCountByCode.set(code,aplicadas.length);continue;}
  const conFecha=aplicadas.filter(d=>!!d.occurredAt).sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt)));
  const sinFecha=aplicadas.length-conFecha.length;
  let validas=0;let ultimaValida:string|undefined;
  for(const d of conFecha){
   const entry=serie[Math.min(validas,serie.length-1)]!;
   const minAge=entry.minAgeMonths??entry.ageMonths;
   const minInterval=entry.minIntervalMonths??DEFAULT_MIN_INTERVAL_MONTHS;
   const edad=ageInMonths(birthDate,String(d.occurredAt));
   if(Number.isFinite(edad)&&edad<minAge){
    invalidated.push({code,doseNumber:validas+1,occurredAt:String(d.occurredAt),reasonCode:"BELOW_MIN_AGE",
     detail:`${entry.label}: aplicada a los ${edad} meses; la edad mínima es ${minAge}. La dosis no cuenta para la serie y debe repetirse.`});
    continue;
   }
   if(ultimaValida!==undefined){
    const desde=ageInMonths(ultimaValida,String(d.occurredAt));
    if(Number.isFinite(desde)&&desde<minInterval){
     invalidated.push({code,doseNumber:validas+1,occurredAt:String(d.occurredAt),reasonCode:"BELOW_MIN_INTERVAL",
      detail:`${entry.label}: aplicada ${desde} mes(es) después de la dosis anterior; el intervalo mínimo es ${minInterval}. La dosis no cuenta para la serie y debe repetirse.`});
     continue;
    }
   }
   validas+=1;ultimaValida=String(d.occurredAt);
  }
  validCountByCode.set(code,validas+sinFecha);
 }
 return{validCountByCode,invalidated};
}
// Pronóstico: por cada dosis del esquema, su estado según la edad, la ventana de aplicabilidad y lo aplicado.
// graceMonths: ventana antes de considerar OVERDUE (por defecto 1 mes).
export function forecastImmunizations(birthDate:string,administered:readonly(string|AdministeredDose)[],asOf:string,graceMonths=1):ForecastDose[]{
 const age=ageInMonths(birthDate,asOf);
 if(Number.isNaN(age))return[];
 const doses=normalizeAdministered(administered);
 const countByCode=new Map<string,number>();for(const d of doses)countByCode.set(d.code,(countByCode.get(d.code)??0)+1);
 // R03-30: se valida cada dosis aplicada contra la EDAD MÍNIMA y el INTERVALO MÍNIMO de su posición en la serie. Una
 // dosis prematura no cuenta (hay que repetirla), que es la diferencia entre un pronóstico y un contador.
 const{validCountByCode,invalidated}=validateAdministered(birthDate,doses);
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
  const appliedForCode=validCountByCode.get(code)??0;
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
/**
 * R03-30: `forecastImmunizations` devuelve `[]` cuando la fecha de nacimiento no se puede interpretar, y un arreglo vacío
 * es INDISTINGUIBLE de «sin pendientes»: el sistema informaba «nada que vacunar» ante un dato mal capturado. Este
 * envoltorio es el que deben usar las rutas: distingue el error del silencio y devuelve también las dosis invalidadas.
 */
export function forecast(birthDate:string,administered:readonly(string|AdministeredDose)[],asOf:string,graceMonths=1):Forecast{
 const age=ageInMonths(birthDate,asOf);
 if(Number.isNaN(age))return{ok:false,reasonCode:"INVALID_BIRTH_DATE",
  detail:`Fecha de nacimiento no interpretable («${birthDate}»): sin ella no hay esquema que pronosticar. No es «sin pendientes».`};
 const doses=forecastImmunizations(birthDate,administered,asOf,graceMonths);
 const{invalidated}=validateAdministered(birthDate,normalizeAdministered(administered));
 return{ok:true,doses,invalidated,ageMonths:age};
}
// Resumen para priorización: cuántas OVERDUE / DUE (las NOT_APPLICABLE no cuentan como pendientes).
export function forecastSummary(doses:readonly ForecastDose[]){
 return{overdue:doses.filter(d=>d.status==="OVERDUE").length,due:doses.filter(d=>d.status==="DUE").length,upcoming:doses.filter(d=>d.status==="UPCOMING").length,complete:doses.filter(d=>d.status==="COMPLETE").length,notApplicable:doses.filter(d=>d.status==="NOT_APPLICABLE").length};
}

// Auditoría 2026-09-19, anexo R02a (IMM-01) — CATÁLOGO de vacunas y sus COMPONENTES con relevancia alérgica.
//
// Dos defectos que cubre: (1) `vaccineCode` era texto libre —"BCG", "bcg", "Bacilo Calmette" y "XYZ" entraban igual, con
// lo que el esquema de vacunación no podía cruzar nada—; y (2) no existía ningún cruce con las alergias registradas
// antes de administrar, que es el control más básico de una vacuna.
//
// Los componentes son los que la literatura reconoce como causa de reacción de hipersensibilidad y que un expediente
// puede tener registrados como alergia: huevo (cultivo en embrión de pollo), gelatina (estabilizante), neomicina y otros
// antibióticos de proceso, levadura (Hepatitis B recombinante), látex (tapón del vial) y proteínas de la propia vacuna.
// Esta lista es criterio conservador de ingeniería y NO sustituye la ficha técnica del lote que se aplica: por eso el
// sistema AVISA (no bloquea) y exige que el médico lo confirme, salvo que la alergia registrada sea GRAVE.
export const VACCINE_CODES:readonly string[]=[...new Set(SCHEDULE.map(e=>e.code))];
export const isVaccineCode=(code:string):boolean=>VACCINE_CODES.includes(code.trim().toUpperCase());
// Nombre BASE legible por código (sin el sufijo de dosis): derivado del propio esquema, no inventado. Se usa para mostrar
// las vacunas aplicadas del paciente con su nombre, no con el código crudo. Un código sin entrada devuelve el código tal cual.
const VACCINE_LABEL_BY_CODE:ReadonlyMap<string,string>=(()=>{const m=new Map<string,string>();for(const e of SCHEDULE){if(!m.has(e.code))m.set(e.code,e.label.replace(/\s*\([^)]*\)\s*$/,"").trim());}return m;})();
export const vaccineLabel=(code:string):string=>VACCINE_LABEL_BY_CODE.get(code.trim().toUpperCase())??code;
/** Componentes con relevancia alérgica por código de vacuna (para cruzar con las alergias registradas del paciente). */
export const VACCINE_COMPONENTS:Readonly<Record<string,readonly string[]>>={
 BCG:["neomicina"],
 HEPB:["levadura","latex"],
 PENTA:["neomicina","polimixina","latex"],
 ROTA:["latex"],
 NEUMO:["latex"],
 SRP:["huevo","gelatina","neomicina"],       // sarampión-rubéola-parotiditis: cultivo en fibroblasto de embrión de pollo
 DPT:["neomicina","latex"],
 TD:["latex"],
 VPH:["levadura","latex"],
 INFLUENZA:["huevo","gelatina","latex"],      // cultivo en huevo embrionado
 NEUMO23:["latex"],
};
// Un código del esquema sin componentes declarados no es «sin riesgo»: es «no declarado». Un test lo exige explícito.
export const vaccineComponents=(code:string):readonly string[]=>VACCINE_COMPONENTS[code.trim().toUpperCase()]??[];
