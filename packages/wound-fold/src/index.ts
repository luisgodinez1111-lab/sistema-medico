import{ClinicalError}from"../../runtime-errors/src";
// EPIC AI — Fold puro del stream de una lesión por presión / herida (wound care, valoración longitudinal).
// SM: OPEN -> {OPEN (re-evaluación de estadio), HEALED, ESCALATED}. HEALED/ESCALATED son terminales.
// El estadio vigente es el de la última valoración. Autoridad: PROD (cuidado de heridas / calidad, UPP), CAP-WOUND-001.
// location/stage son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type WoundState="OPEN"|"HEALED"|"ESCALATED";
export type WoundEventKind="DOCUMENTED"|"REASSESSED"|"HEALED"|"ESCALATED";
export type StoredWoundEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedWound=Readonly<{exists:boolean;state:WoundState;version:number;patientId:string;location:string;stage:string}>;

function kindOf(e:StoredWoundEvent):WoundEventKind{
 const k=e.payload["kind"];
 if(k==="DOCUMENTED"||k==="REASSESSED"||k==="HEALED"||k==="ESCALATED")return k;
 if(e.sequence===1&&k===undefined)return "DOCUMENTED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown wound event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<WoundEventKind,WoundState>={DOCUMENTED:"OPEN",REASSESSED:"OPEN",HEALED:"HEALED",ESCALATED:"ESCALATED"};
export function foldWound(events:readonly StoredWoundEvent[]):FoldedWound{
 if(events.length===0)return{exists:false,state:"OPEN",version:0,patientId:"",location:"",stage:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:WoundState="OPEN",patientId="",location="",stage="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="DOCUMENTED"){patientId=String(e.payload["patientId"]??"");location=String(e.payload["location"]??"");}
  // El estadio vigente es el de la última valoración que lo aporta.
  if((kindOf(e)==="DOCUMENTED"||kindOf(e)==="REASSESSED")&&e.payload["stage"]!==undefined)stage=String(e.payload["stage"]);
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,location,stage};
}
const ALLOWED:Partial<Record<WoundState,readonly WoundState[]>>={
 OPEN:["OPEN","HEALED","ESCALATED"],
};
export function assertWoundTransition(from:WoundState,to:WoundState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal wound transition ${from} -> ${to}`,{from,to});
}
