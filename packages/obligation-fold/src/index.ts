import{ClinicalError}from"../../runtime-errors/src";
// EPIC O — Fold puro del stream de eventos de una obligación clínica (seguimiento / care gap).
// Subconjunto determinista de la SM de obligation-domain: OPEN -> IN_PROGRESS -> COMPLETED, con
// CANCELLED desde OPEN/IN_PROGRESS. Completar exige evidencia. Autoridad: CAP-OBLIGATION-002.
export type ObligationSt="OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";
export type ObEventKind="CREATED"|"STARTED"|"COMPLETED"|"CANCELLED";
export type StoredObEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedObligation=Readonly<{exists:boolean;state:ObligationSt;version:number;patientId:string}>;

function kindOf(e:StoredObEvent):ObEventKind{
 const k=e.payload["kind"];
 if(k==="CREATED"||k==="STARTED"||k==="COMPLETED"||k==="CANCELLED")return k;
 if(e.sequence===1)return "CREATED";
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown obligation event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ObEventKind,ObligationSt>={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export function foldObligation(events:readonly StoredObEvent[]):FoldedObligation{
 if(events.length===0)return{exists:false,state:"OPEN",version:0,patientId:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ObligationSt="OPEN",patientId="";
 for(const e of ordered){state=KIND_TO_STATE[kindOf(e)];if(kindOf(e)==="CREATED")patientId=String(e.payload["patientId"]??"");}
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId};
}
const ALLOWED:Partial<Record<ObligationSt,readonly ObligationSt[]>>={
 OPEN:["IN_PROGRESS","COMPLETED","CANCELLED"],IN_PROGRESS:["COMPLETED","CANCELLED"],
};
export function assertObligationTransition(from:ObligationSt,to:ObligationSt){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal obligation transition ${from} -> ${to}`,{from,to});
}

// ---------- Auditoría 2026-09-19 (L-01) — qué obligaciones BLOQUEAN la firma del encuentro (Zero Lost Follow-Up) ----------
// Antes el gate contaba filas de `clinical_inbox`, una tabla en la que ningún código inserta: devolvía siempre 0. La fuente de
// verdad de una obligación es su stream de eventos; el criterio es esta función PURA (testeable sin base de datos):
//   · solo bloquea lo NO resuelto (OPEN / IN_PROGRESS);
//   · URGENT sin resolver bloquea: alguien decidió que no puede esperar;
//   · VENCIDA sin resolver bloquea: un seguimiento cuya fecha pasó sin cierre ES un seguimiento perdido. La salida es explícita:
//     completar con evidencia o cancelar con motivo (nunca desaparece sin estado terminal);
//   · una obligación FUTURA y no urgente NO bloquea: tiene responsable y fecha, el seguimiento está en curso;
//   · fecha límite ilegible => bloquea (fail-closed: no se puede afirmar que NO esté vencida).
export type ObligationPriority="URGENT"|"HIGH"|"ROUTINE";
export type SignatureBlockReason="URGENT"|"OVERDUE"|"INVALID_DUE_DATE";
export function signatureBlockReason(o:Readonly<{state:ObligationSt;priority?:string|null;dueAt?:string|null}>,asOfIso:string):SignatureBlockReason|undefined{
 if(o.state!=="OPEN"&&o.state!=="IN_PROGRESS")return undefined;
 if(o.priority==="URGENT")return "URGENT";
 const due=Date.parse(o.dueAt??"");const asOf=Date.parse(asOfIso);
 if(!Number.isFinite(due)||!Number.isFinite(asOf))return "INVALID_DUE_DATE";
 return due<asOf?"OVERDUE":undefined;
}
