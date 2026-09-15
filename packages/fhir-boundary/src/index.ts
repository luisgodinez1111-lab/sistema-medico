export type FhirEnvelope=Readonly<{resourceType:string;id?:string;meta?:{versionId?:string};raw:unknown;trust:"UNVERIFIED"|"VALIDATED"}>;
const allowed=new Set(["Patient","Encounter","Observation","DiagnosticReport","MedicationRequest","Condition","ServiceRequest"]);
export function ingestFhir(x:any):FhirEnvelope{if(!x||!allowed.has(x.resourceType))throw new Error("FHIR_RESOURCE_UNSUPPORTED");return Object.freeze({resourceType:x.resourceType,id:x.id,meta:x.meta,raw:x,trust:"UNVERIFIED"});}
export function validateFhir(e:FhirEnvelope){return Object.freeze({...e,trust:"VALIDATED" as const});}
