// EPIC P — Resumen/estado computado del paciente (proyección PURA sobre el timeline). Autoridad:
// CAP-PATIENT-STATE-002 (Computed Patient State Composer), CAP-TIMELINE-002. Sin PHI: solo conteos.
export type TimelineLike=Readonly<{aggregateType:string;latestKind:string}>;
export type PatientSummary=Readonly<{openObligations:number;activeMedications:number;openResults:number;openOrders:number;signedEncounters:number;totalItems:number}>;
// "Abierto" = el último evento del agregado no es un estado terminal para ese tipo.
export function summarizePatient(items:readonly TimelineLike[]):PatientSummary{
 let openObligations=0,activeMedications=0,openResults=0,openOrders=0,signedEncounters=0;
 for(const it of items){
  const k=it.latestKind;
  switch(it.aggregateType){
   case"ClinicalObligation":if(k!=="COMPLETED"&&k!=="CANCELLED")openObligations++;break;
   case"Medication":if(k==="ACTIVATED")activeMedications++;break;
   case"DiagnosticResult":if(k!=="CLOSED")openResults++;break;
   case"ClinicalOrder":if(k!=="FULFILLED"&&k!=="CANCELLED")openOrders++;break;
   case"Encounter":if(k==="SIGNED")signedEncounters++;break;
  }
 }
 return Object.freeze({openObligations,activeMedications,openResults,openOrders,signedEncounters,totalItems:items.length});
}
