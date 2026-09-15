export type Epistemic="FACT"|"DERIVED"|"INFERENCE"|"RECOMMENDATION"|"DECISION";
export type ClinicalNode=Readonly<{id:string;kind:"PROBLEM"|"HYPOTHESIS"|"EVIDENCE";epistemic:Epistemic;label:string}>;
export type ClinicalEdge=Readonly<{from:string;to:string;relation:"SUPPORTS"|"CONTRADICTS"|"EXPLAINS"|"RULES_OUT_CANDIDATE";provenanceId:string}>;
export function addEdge(nodes:readonly ClinicalNode[],edges:readonly ClinicalEdge[],e:ClinicalEdge){const ids=new Set(nodes.map(n=>n.id));if(!ids.has(e.from)||!ids.has(e.to))throw new Error("GRAPH_NODE_MISSING");if(!e.provenanceId)throw new Error("PROVENANCE_REQUIRED");return [...edges,Object.freeze(e)];}
