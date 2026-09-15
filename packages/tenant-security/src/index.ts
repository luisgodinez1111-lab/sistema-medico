
export type AccessContext=Readonly<{tenantId:string;actorId:string;roles:readonly string[];purpose:"TREATMENT"|"OPERATIONS"|"BILLING"|"RESEARCH";patientId?:string}>;
export function assertTenantBoundary(resourceTenant:string,ctx:AccessContext){
 if(resourceTenant!==ctx.tenantId) throw new Error("CROSS_TENANT_ACCESS_BLOCKED"); return true;
}
export function requireRole(ctx:AccessContext,roles:readonly string[]){
 if(!roles.some(r=>ctx.roles.includes(r))) throw new Error("ROLE_AUTHORIZATION_REQUIRED"); return true;
}
export function requireTreatmentPurpose(ctx:AccessContext){
 if(ctx.purpose!=="TREATMENT") throw new Error("CLINICAL_PURPOSE_REQUIRED"); return true;
}
