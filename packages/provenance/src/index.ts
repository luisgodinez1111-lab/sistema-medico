export type Provenance=Readonly<{id:string;sourceType:"HUMAN"|"DEVICE"|"IMPORT"|"DERIVED"|"AI";sourceId:string;recordedAt:string;authority:readonly string[];contentHash:string}>;
export function requireProvenance<T extends {provenanceId?:string}>(x:T){if(!x.provenanceId)throw new Error("PROVENANCE_REQUIRED");return x;}
