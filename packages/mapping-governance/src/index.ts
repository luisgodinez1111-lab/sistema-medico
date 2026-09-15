export type MappingStatus="HUMAN_REVIEW_PENDING"|"APPROVED_PRIMARY"|"APPROVED_SECONDARY"|"REJECTED";
export type Mapping=Readonly<{source:string;target:string;status:MappingStatus;reviewer?:string;evidence?:string}>;
export function mappingGate(rows:readonly Mapping[]){const pending=rows.filter(x=>x.status==="HUMAN_REVIEW_PENDING").length;const unreviewedApproved=rows.filter(x=>x.status.startsWith("APPROVED")&&!x.reviewer).length;return{admitted:pending===0&&unreviewedApproved===0,pending,unreviewedApproved};}
