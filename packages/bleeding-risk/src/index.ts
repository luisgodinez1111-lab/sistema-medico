// HAS-BLED — riesgo de SANGRADO mayor en pacientes con fibrilación auricular/anticoagulación (Pisters R et al., Chest
// 2010;138:1093-1100). Determinista y puro. Se usa JUNTO a CHA₂DS₂-VASc (riesgo trombótico) para una decisión EQUILIBRADA:
// un HAS-BLED alto NO contraindica anticoagular — señala corregir factores modificables (PA, fármacos, alcohol, INR) y
// vigilar de cerca. 1 punto por ítem, máximo 9. El INR lábil puede no ser evaluable (requiere TTR): se reporta aparte y el
// score queda como MÍNIMO, nunca se inventa el punto.
export type HasBledInputs=Readonly<{
 hypertensionUncontrolled:boolean; // PAS > 160 mmHg
 abnormalRenal:boolean;            // diálisis/trasplante/Cr>2.26 mg/dL (o TFG muy baja)
 abnormalLiver:boolean;            // cirrosis o bilirrubina/transaminasas muy elevadas
 strokeHistory:boolean;
 bleedingHistory:boolean;          // hemorragia mayor previa o predisposición (anemia)
 labileINR?:boolean|undefined;     // TTR<60%; undefined = NO evaluable (sin TTR)
 elderly:boolean;                  // edad > 65
 drugsAntiplateletOrNsaid:boolean; // antiagregantes/AINE concomitantes
 alcoholExcess:boolean;            // ≥8 bebidas/semana
}>;
export type BleedingRisk="LOW"|"MODERATE"|"HIGH";
export type HasBledResult=Readonly<{score:number;risk:BleedingRisk;components:readonly string[];notAssessed:readonly string[]}>;

export function hasBled(i:HasBledInputs):HasBledResult{
 const c:string[]=[];const na:string[]=[];
 if(i.hypertensionUncontrolled)c.push("hipertensión no controlada (PAS>160)");
 if(i.abnormalRenal)c.push("función renal alterada");
 if(i.abnormalLiver)c.push("función hepática alterada");
 if(i.strokeHistory)c.push("ictus previo");
 if(i.bleedingHistory)c.push("hemorragia previa/predisposición");
 if(i.labileINR===true)c.push("INR lábil");else if(i.labileINR===undefined)na.push("INR lábil (TTR no disponible)");
 if(i.elderly)c.push("edad >65");
 if(i.drugsAntiplateletOrNsaid)c.push("antiagregante/AINE concomitante");
 if(i.alcoholExcess)c.push("consumo de alcohol");
 const score=c.length;
 // HAS-BLED: 0 bajo, 1–2 moderado, ≥3 alto (umbral clásico de "alto riesgo" que obliga a vigilar y corregir factores).
 const risk:BleedingRisk=score>=3?"HIGH":score>=1?"MODERATE":"LOW";
 return{score,risk,components:c,notAssessed:na};
}
