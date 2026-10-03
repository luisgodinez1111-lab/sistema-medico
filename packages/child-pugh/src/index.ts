// EPIC BW (ampliación) — Child-Pugh-Turcotte: gravedad de la hepatopatía CRÓNICA (cirrosis) y riesgo quirúrgico. A
// diferencia del MELD (solo laboratorio), exige DOS ejes CLÍNICOS graduados que valora el médico en la exploración:
// ASCITIS y ENCEFALOPATÍA. Sin esos dos grados NO es calculable (no se inventan). 1–3 puntos por ítem, total 5–15;
// clase A 5–6, B 7–9, C 10–15. Fuente: Pugh RNH et al., Br J Surg 1973;60:646-649 (modificación de Child-Turcotte). Puro.
export type CPGrade=1|2|3; // ascitis: 1 ninguna · 2 leve/controlada · 3 moderada-tensa/refractaria. encefalopatía: 1 ninguna · 2 grado I–II · 3 grado III–IV
export type ChildPughClass="A"|"B"|"C";
export type ChildPughInputs=Readonly<{bilirubin:number;albumin:number;inr:number;ascites:CPGrade;encephalopathy:CPGrade}>;
export type ChildPughComponents=Readonly<{bilirubin:CPGrade;albumin:CPGrade;inr:CPGrade;ascites:CPGrade;encephalopathy:CPGrade}>;
export type ChildPughResult=Readonly<{score:number;childClass:ChildPughClass;components:ChildPughComponents;interpretation:string}>;
const isGrade=(g:unknown):g is CPGrade=>g===1||g===2||g===3;
export function childPugh(i:ChildPughInputs):ChildPughResult|undefined{
 if(![i.bilirubin,i.albumin,i.inr].every(Number.isFinite)||i.bilirubin<0||i.albumin<=0||i.inr<=0)return undefined;
 if(!isGrade(i.ascites)||!isGrade(i.encephalopathy))return undefined; // los dos ejes clínicos son obligatorios
 // Umbrales de la tabla (bilirrubina mg/dL, albúmina g/dL, INR). Puntos 1/2/3.
 const bili:CPGrade=i.bilirubin<2?1:i.bilirubin<=3?2:3;
 const alb:CPGrade=i.albumin>3.5?1:i.albumin>=2.8?2:3;
 const inr:CPGrade=i.inr<1.7?1:i.inr<=2.3?2:3;
 const score=bili+alb+inr+i.ascites+i.encephalopathy; // 5–15
 const childClass:ChildPughClass=score<=6?"A":score<=9?"B":"C";
 // Sin cifras de supervivencia inventadas: se enuncia la clase y lo que implica cualitativamente (a mayor clase, mayor
 // mortalidad perioperatoria y peor pronóstico), que es lo que la clase de Child-Pugh sostiene con evidencia.
 const sentido=childClass==="A"?"enfermedad compensada, mejor pronóstico quirúrgico":childClass==="B"?"descompensación significativa, riesgo quirúrgico aumentado":"descompensación grave, alto riesgo quirúrgico y peor pronóstico";
 return{score,childClass,components:{bilirubin:bili,albumin:alb,inr,ascites:i.ascites,encephalopathy:i.encephalopathy},
  interpretation:`Child-Pugh ${childClass} (${score} puntos): ${sentido} (Pugh 1973).`};
}
