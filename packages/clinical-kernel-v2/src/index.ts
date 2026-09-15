export type ClinicalTruth='OBSERVED'|'DERIVED'|'INFERRED'|'RECOMMENDED'|'DECIDED';
export type ClinicalStatus='KNOWN'|'UNKNOWN'|'NOT_APPLICABLE'|'CONFLICTING'|'UNAVAILABLE';
export type ClinicalFact<T>=Readonly<{id:string;truth:ClinicalTruth;status:ClinicalStatus;value?:T;sourceIds:readonly string[];recordedAt:string;actorId:string}>;
export function assertClinicalFact<T>(f:ClinicalFact<T>){if(f.status==='KNOWN'&&f.value===undefined)throw new Error('KNOWN_REQUIRES_VALUE');if(f.status!=='KNOWN'&&f.value!==undefined)throw new Error('NON_KNOWN_CANNOT_CARRY_VALUE');if(!f.sourceIds.length&&f.truth!=='OBSERVED')throw new Error('DERIVED_TRUTH_REQUIRES_PROVENANCE');return f;}
