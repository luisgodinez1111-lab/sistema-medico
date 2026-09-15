
export type PatientStateProjection=Readonly<{patientId:string;openObligations:number;overdueObligations:number;activeMedications:number;openResults:number;lastEncounterAt?:string;version:number}>;
export type PatientSignal={type:"OBLIGATION_OPENED"|"OBLIGATION_OVERDUE"|"OBLIGATION_COMPLETED"|"MEDICATION_STARTED"|"MEDICATION_STOPPED"|"RESULT_OPENED"|"RESULT_CLOSED"|"ENCOUNTER_SIGNED";at?:string};
export function projectPatientState(s:PatientStateProjection,e:PatientSignal):PatientStateProjection{
 const n={...s,version:s.version+1};
 switch(e.type){case"OBLIGATION_OPENED":n.openObligations++;break;case"OBLIGATION_OVERDUE":n.overdueObligations++;break;case"OBLIGATION_COMPLETED":n.openObligations=Math.max(0,n.openObligations-1);break;case"MEDICATION_STARTED":n.activeMedications++;break;case"MEDICATION_STOPPED":n.activeMedications=Math.max(0,n.activeMedications-1);break;case"RESULT_OPENED":n.openResults++;break;case"RESULT_CLOSED":n.openResults=Math.max(0,n.openResults-1);break;case"ENCOUNTER_SIGNED":if(e.at!==undefined)n.lastEncounterAt=e.at;break;}return Object.freeze(n);
}