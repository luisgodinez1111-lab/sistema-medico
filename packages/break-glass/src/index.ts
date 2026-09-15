export type BreakGlass=Readonly<{actorId:string;patientId:string;reason:string;expiresAt:number;approvedBy?:string}>;
export function authorizeBreakGlass(x:BreakGlass,now:number){if(!x.reason)throw new Error("BREAK_GLASS_REASON_REQUIRED");if(now>=x.expiresAt)throw new Error("BREAK_GLASS_EXPIRED");return{allowed:true,auditRequired:true,reviewRequired:true};}
