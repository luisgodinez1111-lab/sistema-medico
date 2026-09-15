import type{ClinicalClock}from"../../clinical-clock/src";import{systemClinicalClock}from"../../clinical-clock/src";
export type PatientStateInput=Readonly<{patientId:string;openResults:number;openObligations:number;overdueObligations:number;activeMedications:number;lastEncounterAt?:string;projectionSequence:number}>;
export function composePatientState(x:PatientStateInput,clock:ClinicalClock=systemClinicalClock){return Object.freeze({...x,riskFlags:[...(x.overdueObligations>0?["OVERDUE_FOLLOWUP"]:[]),...(x.openResults>0?["OPEN_RESULTS"]:[])],computedAt:clock.now().toISOString()});}
