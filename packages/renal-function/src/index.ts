// EPIC BL — Función renal estimada (eGFR) por CKD-EPI 2021 (race-free, estándar actual) + estadificación ERC
// (KDIGO G1–G5). PROFUNDIDAD del eje C: convierte una creatinina cruda en función renal interpretada, base
// para el ajuste renal de dosis. Puro, sin PHI (recibe valor, edad, sexo). Validado para ADULTOS (>=18);
// en pediatría se usa Schwartz (no se computa aquí, se reporta not-computable). Umbrales KDIGO.
export type Sex="FEMALE"|"MALE";
export type CkdStage=Readonly<{stage:string;label:string}>;
export function ckdStage(egfr:number):CkdStage{
 if(egfr>=90)return{stage:"G1",label:"Normal o alto"};
 if(egfr>=60)return{stage:"G2",label:"Levemente disminuido"};
 if(egfr>=45)return{stage:"G3a",label:"Leve a moderadamente disminuido"};
 if(egfr>=30)return{stage:"G3b",label:"Moderada a severamente disminuido"};
 if(egfr>=15)return{stage:"G4",label:"Severamente disminuido"};
 return{stage:"G5",label:"Falla renal"};
}
export type EgfrResult=Readonly<{egfr:number;stage:string;label:string}>;
// CKD-EPI 2021: 142 · min(Scr/κ,1)^α · max(Scr/κ,1)^-1.200 · 0.9938^edad · (1.012 si mujer). Scr en mg/dL.
export function computeEGFR(scrMgDl:number,ageYears:number,sex:Sex):EgfrResult|undefined{
 if(!(scrMgDl>0)||!(ageYears>0)||!Number.isFinite(scrMgDl)||!Number.isFinite(ageYears))return undefined;
 const female=sex==="FEMALE";
 const k=female?0.7:0.9;const a=female?-0.241:-0.302;
 const ratio=scrMgDl/k;
 const raw=142*Math.pow(Math.min(ratio,1),a)*Math.pow(Math.max(ratio,1),-1.200)*Math.pow(0.9938,ageYears)*(female?1.012:1);
 const egfr=Math.round(raw*10)/10;
 const s=ckdStage(egfr);
 return{egfr,stage:s.stage,label:s.label};
}
