// EPIC AN — Rangos de referencia e interpretación de signos vitales (PROFUNDIDAD del eje C).
// Convierte un valor de texto en una interpretación clínica estructurada: NORMAL / ABNORMAL / CRITICAL.
// Reglas deterministas para adulto (aproximación de demostración; los umbrales oficiales/edad se
// parametrizarían del protocolo institucional). Puro, sin PHI. Autoridad: PROD (CDS básico), CAP-VITALS-REF-001.
export type VitalStatus="NORMAL"|"ABNORMAL"|"CRITICAL"|"UNKNOWN";
export type VitalAssessment=Readonly<{status:VitalStatus;interpretation:string}>;

function num(x:string):number{const n=Number(String(x).trim());return Number.isFinite(n)?n:NaN;}
function worst(a:VitalStatus,b:VitalStatus):VitalStatus{const rank={CRITICAL:0,ABNORMAL:1,NORMAL:2,UNKNOWN:3} as const;return rank[a]<=rank[b]?a:b;}

export function classifyVital(vitalType:string,value:string):VitalAssessment{
 const t=vitalType.trim().toUpperCase();
 switch(t){
  case"BP":{
   const m=/^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(String(value).trim());
   if(!m)return{status:"UNKNOWN",interpretation:"Formato de presión no reconocido (esperado S/D)"};
   const s=Number(m[1]),d=Number(m[2]);
   let ss:VitalStatus="NORMAL";if(s>=180||s<70)ss="CRITICAL";else if(s>=140||s<90)ss="ABNORMAL";
   let ds:VitalStatus="NORMAL";if(d>=120)ds="CRITICAL";else if(d>=90||d<60)ds="ABNORMAL";
   const st=worst(ss,ds);
   const label=st==="CRITICAL"?(s>=180||d>=120?"Crisis hipertensiva":"Hipotensión severa"):st==="ABNORMAL"?(s>=140||d>=90?"Hipertensión":"Hipotensión"):"Presión normal";
   return{status:st,interpretation:label};
  }
  case"HR":{const v=num(value);if(Number.isNaN(v))return{status:"UNKNOWN",interpretation:"Valor no numérico"};
   if(v<40||v>130)return{status:"CRITICAL",interpretation:v>130?"Taquicardia severa":"Bradicardia severa"};
   if(v<60||v>100)return{status:"ABNORMAL",interpretation:v>100?"Taquicardia":"Bradicardia"};
   return{status:"NORMAL",interpretation:"Frecuencia cardíaca normal"};}
  case"SPO2":{const v=num(value);if(Number.isNaN(v))return{status:"UNKNOWN",interpretation:"Valor no numérico"};
   if(v<90)return{status:"CRITICAL",interpretation:"Hipoxemia severa"};
   if(v<94)return{status:"ABNORMAL",interpretation:"Hipoxemia"};
   return{status:"NORMAL",interpretation:"Saturación normal"};}
  case"TEMP":{const v=num(value);if(Number.isNaN(v))return{status:"UNKNOWN",interpretation:"Valor no numérico"};
   if(v>=40||v<=35)return{status:"CRITICAL",interpretation:v>=40?"Hipertermia":"Hipotermia"};
   if(v>=38||v<36)return{status:"ABNORMAL",interpretation:v>=38?"Fiebre":"Temperatura baja"};
   return{status:"NORMAL",interpretation:"Temperatura normal"};}
  case"RESP":{const v=num(value);if(Number.isNaN(v))return{status:"UNKNOWN",interpretation:"Valor no numérico"};
   if(v<8||v>30)return{status:"CRITICAL",interpretation:v>30?"Taquipnea severa":"Bradipnea severa"};
   if(v<12||v>20)return{status:"ABNORMAL",interpretation:v>20?"Taquipnea":"Bradipnea"};
   return{status:"NORMAL",interpretation:"Frecuencia respiratoria normal"};}
  default:return{status:"UNKNOWN",interpretation:"Sin rango de referencia para este tipo"};
 }
}
