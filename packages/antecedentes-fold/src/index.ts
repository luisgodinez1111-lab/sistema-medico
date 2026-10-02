import{ClinicalError}from"../../runtime-errors/src";
// MATRIZ FUNDACIONAL — Fold puro del stream de los ANTECEDENTES (historia clínica basal) de UN paciente.
// Singleton por paciente (un agregado por paciente, su id se deriva del patientId): se CAPTURA una vez (RECORDED) y se
// ENMIENDA cuantas veces haga falta (AMENDED), como una observación append-only con corrección. El contenido vigente es el
// del último evento que lo aporta —la matriz se edita y se guarda entera, nunca se sobrescribe el histórico—.
// SM: RECORDED -> AMENDED; AMENDED -> AMENDED. No hay estado terminal (los antecedentes siempre pueden actualizarse).
// Autoridad: PROD (historia clínica). `content` son datos clínicos: viven en payload bajo RLS, nunca en logs.
export type AntecedentesState="RECORDED"|"AMENDED";
export type AntecedentesEventKind="RECORDED"|"AMENDED";
export type StoredAntecedentesEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
// El contenido es la matriz estructurada (secciones de la historia clínica). El fold lo trata como opaco: su forma la
// validan el esquema de payload (payload-schemas.ts) y el handler (Zod). Así el fold no cambia si la matriz gana campos.
export type AntecedentesContent=Record<string,unknown>;
export type FoldedAntecedentes=Readonly<{exists:boolean;state:AntecedentesState;version:number;patientId:string;content:AntecedentesContent;updatedAt:string}>;

function kindOf(e:StoredAntecedentesEvent):AntecedentesEventKind{
 const k=e.payload["kind"];
 if(k==="RECORDED"||k==="AMENDED")return k;
 if(e.sequence===1)return "RECORDED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown antecedentes event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<AntecedentesEventKind,AntecedentesState>={RECORDED:"RECORDED",AMENDED:"AMENDED"};
export function foldAntecedentes(events:readonly StoredAntecedentesEvent[]):FoldedAntecedentes{
 if(events.length===0)return{exists:false,state:"RECORDED",version:0,patientId:"",content:{},updatedAt:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:AntecedentesState="RECORDED",patientId="",content:AntecedentesContent={},updatedAt="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="RECORDED")patientId=String(e.payload["patientId"]??"");
  // El contenido vigente es el del último evento que lo aporta (RECORDED o AMENDED): captura o enmienda reemplaza la matriz.
  const c=e.payload["content"];
  if(c!==undefined&&c!==null&&typeof c==="object"&&!Array.isArray(c))content=c as AntecedentesContent;
  const at=e.payload["occurredAt"];if(typeof at==="string"&&at)updatedAt=at;
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,content,updatedAt};
}
const ALLOWED:Partial<Record<AntecedentesState,readonly AntecedentesState[]>>={
 RECORDED:["AMENDED"],AMENDED:["AMENDED"],
};
export function assertAntecedentesTransition(from:AntecedentesState,to:AntecedentesState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal antecedentes transition ${from} -> ${to}`,{from,to});
}
