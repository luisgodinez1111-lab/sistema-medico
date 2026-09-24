// EPIC BO — Antropometría: IMC (índice de masa corporal) + clasificación nutricional WHO (adultos).
// PROFUNDIDAD del eje C. Puro, sin PHI (recibe kg y metros). En pediatría el IMC se interpreta con percentil
// IMC-para-edad (no las categorías fijas de adulto): se reporta como pediátrico. Umbrales WHO.
export type BmiCategory="UNDERWEIGHT"|"NORMAL"|"OVERWEIGHT"|"OBESITY_I"|"OBESITY_II"|"OBESITY_III";
export type Bmi=Readonly<{bmi:number;category:BmiCategory;label:string}>;
export function bmiCategory(bmi:number):{category:BmiCategory;label:string}{
 if(bmi<18.5)return{category:"UNDERWEIGHT",label:"Bajo peso"};
 if(bmi<25)return{category:"NORMAL",label:"Peso normal"};
 if(bmi<30)return{category:"OVERWEIGHT",label:"Sobrepeso"};
 if(bmi<35)return{category:"OBESITY_I",label:"Obesidad clase I"};
 if(bmi<40)return{category:"OBESITY_II",label:"Obesidad clase II"};
 return{category:"OBESITY_III",label:"Obesidad clase III (mórbida)"};
}
// Auditoría 2026-09-19, anexo R03 (R03-09) — cotas del propio paquete:
//  · IMC plausible en un ser humano vivo: 8 (caquexia extrema documentada) a 100 kg/m² (obesidad superextrema). Fuera de
//    ahí el dato es un error de captura (típicamente talla en el campo equivocado), no un hallazgo nutricional.
//  · Edad mínima para las categorías de adulto: 19 años (OMS). Por debajo, percentil IMC-para-edad — no implementado, así
//    que se declara NO computable en lugar de clasificar con cortes de adulto.
export const BMI_PLAUSIBLE=[8,100]as const;
export const BMI_MIN_ADULT_AGE_YEARS=19;
// IMC = peso(kg) / talla(m)^2. undefined si los valores no son positivos/finitos.
export function computeBMI(weightKg:number,heightM:number):Bmi|undefined{
 if(!(weightKg>0)||!(heightM>0)||!Number.isFinite(weightKg)||!Number.isFinite(heightM))return undefined;
 const bmi=Math.round((weightKg/(heightM*heightM))*10)/10;
 const c=bmiCategory(bmi);
 return{bmi,category:c.category,label:c.label};
}
// Normaliza la talla a METROS: acepta metros (~0.3–2.5) o centímetros (>3 -> /100). undefined si no es válida.
export function heightToMeters(raw:number):number|undefined{
 if(!Number.isFinite(raw)||raw<=0)return undefined;
 const m=raw>3?raw/100:raw;
 return m>=0.3&&m<=2.6?m:undefined;
}

// ---------- Auditoría 2026-09-19 (C-21): UNA sola implementación del IMC para todas las rutas ----------
// Antes había cuatro (dos inferían la unidad de la talla por la magnitud del número, con resultados distintos). Esta es la
// única entrada: recibe los valores crudos del expediente CON su unidad cuando existe. Sin unidad, la talla se infiere por
// magnitud (>3 => centímetros) y se declara `heightUnitAssumed` (nunca en silencio).
export type RawMeasure=Readonly<{value:string|number|null|undefined;unit?:string|null|undefined}>; // `unit` puede venir indefinida (exactOptionalPropertyTypes)
export type BmiFromVitals=Readonly<{bmi:number;category:BmiCategory;label:string;weightKg:number;heightM:number;heightUnitAssumed:boolean}>;
// Auditoría 2026-09-19, anexo R03 (R03-09): factores hacia METROS por unidad declarada. Antes solo se reconocían m, cm y
// mm; una talla en PULGADAS («67 in») caía en la inferencia por magnitud (>3 ⇒ centímetros) y daba 0.67 m, es decir un IMC
// de 155.6 presentado como «obesidad clase III». Una unidad DECLARADA que no se reconoce es un error, no una ocasión para
// adivinar: solo cuando la unidad viene vacía (eventos anteriores a esta corrección) se infiere y se declara `assumed`.
const HEIGHT_TO_M:Readonly<Record<string,number>>={m:1,metro:1,metros:1,cm:0.01,centimetros:0.01,"centímetros":0.01,mm:0.001,in:0.0254,inch:0.0254,inches:0.0254,pulgada:0.0254,pulgadas:0.0254};
const WEIGHT_TO_KG:Readonly<Record<string,number>>={kg:1,kgs:1,kilogramos:1,g:0.001,gr:0.001,gramos:0.001,lb:0.45359237,lbs:0.45359237,libras:0.45359237,oz:0.028349523};
export function heightToMetersWithUnit(raw:number,unit?:string|null):{meters:number;assumed:boolean}|undefined{
 if(!Number.isFinite(raw)||raw<=0)return undefined;
 const u=(unit??"").trim().toLowerCase();
 if(u!==""){
  const f=HEIGHT_TO_M[u];
  if(f===undefined)return undefined; // unidad declarada y desconocida: no se adivina
  const m=raw*f;
  return m>=0.3&&m<=2.6?{meters:m,assumed:false}:undefined;
 }
 const m=heightToMeters(raw);return m===undefined?undefined:{meters:m,assumed:true};
}
export function bmiFromVitals(weight:RawMeasure|undefined,height:RawMeasure|undefined):BmiFromVitals|undefined{
 const w=weight?.value==null||weight.value===""?NaN:Number(String(weight.value).replace(",","."));
 const h=height?.value==null||height.value===""?NaN:Number(String(height.value).replace(",","."));
 if(!Number.isFinite(w)||!Number.isFinite(h))return undefined;
 // Mismo criterio en el peso: una unidad declarada y desconocida invalida el cálculo (150 «u» no se toma por 150 kg).
 const wu=(weight?.unit??"").trim().toLowerCase();
 const wf=wu===""?1:WEIGHT_TO_KG[wu];
 if(wf===undefined)return undefined;
 const weightKg=Math.round(w*wf*1000)/1000;
 const hm=heightToMetersWithUnit(h,height?.unit);if(!hm)return undefined;
 const b=computeBMI(weightKg,hm.meters);if(!b)return undefined;
 return{...b,weightKg,heightM:hm.meters,heightUnitAssumed:hm.assumed};
}
