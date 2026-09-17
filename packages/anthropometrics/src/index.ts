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
