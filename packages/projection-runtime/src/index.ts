import crypto from"node:crypto";import{ClinicalError}from"../../runtime-errors/src";
export type Event=Readonly<{id:string;sequence:number;type:string;payload:unknown}>;
export function rebuild<S>(initial:S,events:readonly Event[],apply:(s:S,e:Event)=>S){
 let state=initial,last=0;for(const e of [...events].sort((a,b)=>a.sequence-b.sequence)){if(e.sequence!==last+1)throw new ClinicalError("INVARIANT_VIOLATION","Projection sequence gap");state=apply(state,e);last=e.sequence;}
 const hash=crypto.createHash("sha256").update(JSON.stringify(state)).digest("hex");return{state,lastSequence:last,hash};
}
