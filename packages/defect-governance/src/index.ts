export type DefectAttestation="NOT_ASSESSED"|"ASSESSED"|"HUMAN_APPROVED";
export type Defect=Readonly<{id:string;severity:"S0"|"S1"|"S2"|"S3";status:"OPEN"|"MITIGATED"|"CLOSED"}>;
export function defectGate(a:DefectAttestation,defects:readonly Defect[]){if(a==="NOT_ASSESSED")return{admitted:false,reason:"DEFECTS_NOT_ASSESSED"};if(defects.some(d=>["S0","S1"].includes(d.severity)&&d.status!=="CLOSED"))return{admitted:false,reason:"CRITICAL_DEFECT_OPEN"};return{admitted:a==="HUMAN_APPROVED",reason:a==="HUMAN_APPROVED"?"APPROVED":"HUMAN_APPROVAL_PENDING"};}
