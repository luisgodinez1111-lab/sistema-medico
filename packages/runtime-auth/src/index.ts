import{ClinicalError}from"../../runtime-errors/src";
export type Principal=Readonly<{tenantId:string;actorId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}>;
export function authorize(p:Principal,x:{tenantId:string;role?:string;scope?:string;purpose?:string}){
 if(!p.sessionId)throw new ClinicalError("UNAUTHENTICATED","Verified session required");
 if(p.tenantId!==x.tenantId)throw new ClinicalError("CROSS_TENANT","Cross-tenant access denied");
 if(x.role&&!p.roles.includes(x.role))throw new ClinicalError("FORBIDDEN","Required role missing",{role:x.role});
 if(x.scope&&!p.scopes.includes(x.scope))throw new ClinicalError("FORBIDDEN","Required scope missing",{scope:x.scope});
 if(x.purpose&&p.purpose!==x.purpose)throw new ClinicalError("FORBIDDEN","Purpose mismatch");
 return true;
}
