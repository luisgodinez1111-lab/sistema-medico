import{ClinicalError}from"../../runtime-errors/src";
export type ResultNode=Readonly<{id:string;patientId:string;supersedes?:string;status:"FINAL"|"CORRECTED";value:string}>;
export function assertCorrectionDag(nodes:readonly ResultNode[]){
 const next=new Map(nodes.filter(n=>n.supersedes).map(n=>[n.id,n.supersedes!]));for(const start of next.keys()){const seen=new Set<string>();let x:string|undefined=start;while(x){if(seen.has(x))throw new ClinicalError("INVARIANT_VIOLATION","Corrected-result cycle");seen.add(x);x=next.get(x);}}return true;
}
export function correctResult(original:ResultNode,id:string,value:string):ResultNode{
 if(original.id===id)throw new ClinicalError("INVARIANT_VIOLATION","Correction cannot supersede itself");
 return Object.freeze({id,patientId:original.patientId,supersedes:original.id,status:"CORRECTED",value});
}
