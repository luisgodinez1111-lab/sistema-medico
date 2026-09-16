// EPIC P — Resumen/estado computado del paciente (proyección PURA sobre el timeline). Autoridad:
// CAP-PATIENT-STATE-002 (Computed Patient State Composer), CAP-TIMELINE-002. Sin PHI: solo conteos.
// Epics S–Z: el resumen integra los verticales longitudinales (interconsultas, citas, vacunas,
// signos vitales, planes de cuidados, facturación, consentimientos) además del bucle central.
export type TimelineLike=Readonly<{aggregateType:string;latestKind:string}>;
export type PatientSummary=Readonly<{
 activeAllergies:number;activeProblems:number;openObligations:number;activeMedications:number;
 openResults:number;openOrders:number;signedEncounters:number;
 openReferrals:number;upcomingAppointments:number;pendingImmunizations:number;
 activeCarePlans:number;openClaims:number;grantedConsents:number;activeAdmissions:number;totalItems:number;
}>;
// "Abierto/activo" = el último evento del agregado no es un estado terminal para ese tipo.
export function summarizePatient(items:readonly TimelineLike[]):PatientSummary{
 let activeAllergies=0,activeProblems=0,openObligations=0,activeMedications=0,openResults=0,openOrders=0,signedEncounters=0;
 let openReferrals=0,upcomingAppointments=0,pendingImmunizations=0,activeCarePlans=0,openClaims=0,grantedConsents=0,activeAdmissions=0;
 for(const it of items){
  const k=it.latestKind;
  switch(it.aggregateType){
   case"Allergy":if(k==="RECORDED"||k==="REACTIVATED")activeAllergies++;break;
   case"ClinicalProblem":if(k==="ADDED"||k==="REACTIVATED"||k==="MARKED_CHRONIC")activeProblems++;break;
   case"ClinicalObligation":if(k!=="COMPLETED"&&k!=="CANCELLED")openObligations++;break;
   case"Medication":if(k==="ACTIVATED")activeMedications++;break;
   case"DiagnosticResult":if(k!=="CLOSED")openResults++;break;
   case"ClinicalOrder":if(k!=="FULFILLED"&&k!=="CANCELLED")openOrders++;break;
   case"Encounter":if(k==="SIGNED")signedEncounters++;break;
   case"Referral":if(k==="REQUESTED"||k==="ACCEPTED")openReferrals++;break;
   case"Appointment":if(k==="SCHEDULED"||k==="CHECKED_IN")upcomingAppointments++;break;
   case"Immunization":if(k==="DUE")pendingImmunizations++;break;
   case"CarePlan":if(k==="ACTIVATED"||k==="RESUMED")activeCarePlans++;break;
   case"Claim":if(k!=="PAID"&&k!=="VOIDED")openClaims++;break;
   case"Consent":if(k==="GRANTED")grantedConsents++;break;
   case"Admission":if(k==="ADMITTED"||k==="TRANSFERRED")activeAdmissions++;break;
  }
 }
 return Object.freeze({activeAllergies,activeProblems,openObligations,activeMedications,openResults,openOrders,signedEncounters,openReferrals,upcomingAppointments,pendingImmunizations,activeCarePlans,openClaims,grantedConsents,activeAdmissions,totalItems:items.length});
}
