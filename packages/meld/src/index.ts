// EPIC BW — MELD (Model for End-stage Liver Disease): pronóstico de gravedad/mortalidad en hepatopatía
// avanzada; prioriza trasplante. PROFUNDIDAD del eje C. MELD = 3.78·ln(bilirrubina) + 11.2·ln(INR) +
// 9.57·ln(creatinina) + 6.43. Valores <1 se fijan en 1; creatinina se acota a [1,4]. Score 6–40. Puro, sin PHI.
export type MeldRisk="LOW"|"MODERATE"|"HIGH"|"VERY_HIGH";
export type MeldResult=Readonly<{score:number;risk:MeldRisk;mortality90d:string}>;
export function meldScore(bilirubin:number,inr:number,creatinine:number):MeldResult|undefined{
 if(![bilirubin,inr,creatinine].every(Number.isFinite)||bilirubin<0||inr<=0||creatinine<0)return undefined;
 const bili=Math.max(bilirubin,1),inrC=Math.max(inr,1),creat=Math.min(Math.max(creatinine,1),4);
 const raw=3.78*Math.log(bili)+11.2*Math.log(inrC)+9.57*Math.log(creat)+6.43;
 const score=Math.max(6,Math.min(40,Math.round(raw)));
 let risk:MeldRisk,mortality90d:string;
 if(score<10){risk="LOW";mortality90d="~1.9% mortalidad a 90 días";}
 else if(score<20){risk="MODERATE";mortality90d="~6–20% mortalidad a 90 días";}
 else if(score<30){risk="HIGH";mortality90d="~20–52% mortalidad a 90 días";}
 else{risk="VERY_HIGH";mortality90d="~50–71% mortalidad a 90 días";}
 return{score,risk,mortality90d};
}
