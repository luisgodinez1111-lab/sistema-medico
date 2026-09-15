export type Alert=Readonly<{id:string;severity:"INFO"|"ACTION"|"URGENT";patientId:string;ownerId?:string;reason:string}>;
export function validateAlert(a:Alert){if((a.severity==="ACTION"||a.severity==="URGENT")&&!a.ownerId)throw new Error("ACTIONABLE_ALERT_OWNER_REQUIRED");return a;}
