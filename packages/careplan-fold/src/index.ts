import{ClinicalError}from"../../runtime-errors/src";
// EPIC X — Fold puro del stream de una meta de plan de cuidados (care plan / care gap longitudinal).
// SM: PROPOSED -> ACTIVE -> ACHIEVED; ACTIVE <-> ON_HOLD; {PROPOSED,ACTIVE,ON_HOLD} -> CANCELLED.
// ACHIEVED/CANCELLED son terminales. Autoridad: PROD (care plan / gestión de crónicos), CAP-CAREPLAN-001.
// goal/category/target son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type CarePlanState="PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";
export type CarePlanEventKind="PROPOSED"|"ACTIVATED"|"HELD"|"RESUMED"|"ACHIEVED"|"CANCELLED";
export type StoredCarePlanEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedCarePlan=Readonly<{exists:boolean;state:CarePlanState;version:number;patientId:string;category:string;goal:string}>;

function kindOf(e:StoredCarePlanEvent):CarePlanEventKind{
 const k=e.payload["kind"];
 if(k==="PROPOSED"||k==="ACTIVATED"||k==="HELD"||k==="RESUMED"||k==="ACHIEVED"||k==="CANCELLED")return k;
 if(e.sequence===1)return "PROPOSED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown care plan event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<CarePlanEventKind,CarePlanState>={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",HELD:"ON_HOLD",RESUMED:"ACTIVE",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};
export function foldCarePlan(events:readonly StoredCarePlanEvent[]):FoldedCarePlan{
 if(events.length===0)return{exists:false,state:"PROPOSED",version:0,patientId:"",category:"",goal:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:CarePlanState="PROPOSED",patientId="",category="",goal="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="PROPOSED"){patientId=String(e.payload["patientId"]??"");category=String(e.payload["category"]??"");goal=String(e.payload["goal"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,category,goal};
}
const ALLOWED:Partial<Record<CarePlanState,readonly CarePlanState[]>>={
 PROPOSED:["ACTIVE","CANCELLED"],ACTIVE:["ON_HOLD","ACHIEVED","CANCELLED"],ON_HOLD:["ACTIVE","CANCELLED"],
};
export function assertCarePlanTransition(from:CarePlanState,to:CarePlanState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal care plan transition ${from} -> ${to}`,{from,to});
}
