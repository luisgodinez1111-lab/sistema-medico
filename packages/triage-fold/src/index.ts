import{ClinicalError}from"../../runtime-errors/src";
// EPIC AH — Fold puro del stream de un triage/clasificación de acuidad (front-of-house de urgencias).
// SM: WAITING -> {IN_TRIAGE, LWBS}; IN_TRIAGE -> {TRIAGED, LWBS}; TRIAGED -> {TRIAGED, CLOSED}.
// TRIAGED es re-evaluable (cambio de acuidad); CLOSED/LWBS son terminales. Autoridad: PROD (triage/acuidad), CAP-TRIAGE-001.
// Auditoría R02b (R2B-019): este archivo decía «ESI 1-5» mientras el nivel era un entero que el cliente enviaba. Desde el
// lote 16 el nivel lo DERIVA `packages/emergency-triage` de los discriminadores del algoritmo, y el fold expone el punto de
// decisión y el plazo de reevaluación para que se pueda auditar cómo se llegó al nivel, no solo cuál es.
// chiefComplaint/acuity son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type TriageState="WAITING"|"IN_TRIAGE"|"TRIAGED"|"CLOSED"|"LWBS";
export type TriageEventKind="ARRIVED"|"TRIAGE_STARTED"|"TRIAGED"|"CLOSED"|"LWBS";
export type StoredTriageEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedTriage=Readonly<{exists:boolean;state:TriageState;version:number;patientId:string;chiefComplaint:string;acuity:number;decisionPoint:string;reassessDueAt:string|null;upgradeConsidered:boolean}>;

function kindOf(e:StoredTriageEvent):TriageEventKind{
 const k=e.payload["kind"];
 if(k==="ARRIVED"||k==="TRIAGE_STARTED"||k==="TRIAGED"||k==="CLOSED"||k==="LWBS")return k;
 if(e.sequence===1)return "ARRIVED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown triage event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<TriageEventKind,TriageState>={ARRIVED:"WAITING",TRIAGE_STARTED:"IN_TRIAGE",TRIAGED:"TRIAGED",CLOSED:"CLOSED",LWBS:"LWBS"};
export function foldTriage(events:readonly StoredTriageEvent[]):FoldedTriage{
 if(events.length===0)return{exists:false,state:"WAITING",version:0,patientId:"",chiefComplaint:"",acuity:0,decisionPoint:"",reassessDueAt:null,upgradeConsidered:false};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:TriageState="WAITING",patientId="",chiefComplaint="",acuity=0;
 let decisionPoint="",reassessDueAt:string|null=null,upgradeConsidered=false;
 for(const e of ordered){
  const k=kindOf(e);
  state=KIND_TO_STATE[k];
  if(k==="ARRIVED"){patientId=String(e.payload["patientId"]??"");chiefComplaint=String(e.payload["chiefComplaint"]??"");}
  // La acuidad vigente es la del último triage, y con ella el punto de decisión que la produjo y el plazo de reevaluación.
  // Un evento anterior al lote 16 no trae punto de decisión: queda como cadena vacía en vez de inventarle uno, porque «no
  // consta cómo se clasificó» es exactamente lo que ese evento significa.
  if(k==="TRIAGED"&&e.payload["acuity"]!==undefined){
   acuity=Number(e.payload["acuity"]);
   decisionPoint=String(e.payload["decisionPoint"]??"");
   const d=e.payload["reassessDueAt"];reassessDueAt=typeof d==="string"?d:null;
   upgradeConsidered=e.payload["upgradeConsidered"]===true;
  }
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,chiefComplaint,acuity,decisionPoint,reassessDueAt,upgradeConsidered};
}
const ALLOWED:Partial<Record<TriageState,readonly TriageState[]>>={
 WAITING:["IN_TRIAGE","LWBS"],IN_TRIAGE:["TRIAGED","LWBS"],TRIAGED:["TRIAGED","CLOSED"],
};
export function assertTriageTransition(from:TriageState,to:TriageState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal triage transition ${from} -> ${to}`,{from,to});
}
