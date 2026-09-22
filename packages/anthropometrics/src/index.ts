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
export function heightToMetersWithUnit(raw:number,unit?:string|null):{meters:number;assumed:boolean}|undefined{
 if(!Number.isFinite(raw)||raw<=0)return undefined;
 const u=(unit??"").trim().toLowerCase();
 if(u==="m"||u==="metros"||u==="metro")return raw>=0.3&&raw<=2.6?{meters:raw,assumed:false}:undefined;
 if(u==="cm"||u==="centimetros"||u==="centímetros")return raw>=30&&raw<=260?{meters:raw/100,assumed:false}:undefined;
 if(u==="mm")return raw>=300&&raw<=2600?{meters:raw/1000,assumed:false}:undefined;
 const m=heightToMeters(raw);return m===undefined?undefined:{meters:m,assumed:true};
}
export function bmiFromVitals(weight:RawMeasure|undefined,height:RawMeasure|undefined):BmiFromVitals|undefined{
 const w=weight?.value==null||weight.value===""?NaN:Number(String(weight.value).replace(",","."));
 const h=height?.value==null||height.value===""?NaN:Number(String(height.value).replace(",","."));
 if(!Number.isFinite(w)||!Number.isFinite(h))return undefined;
 const wu=(weight?.unit??"").trim().toLowerCase();const weightKg=wu==="g"?w/1000:wu==="lb"||wu==="libras"?w*0.45359237:w;
 const hm=heightToMetersWithUnit(h,height?.unit);if(!hm)return undefined;
 const b=computeBMI(weightKg,hm.meters);if(!b)return undefined;
 return{...b,weightKg,heightM:hm.meters,heightUnitAssumed:hm.assumed};
}
