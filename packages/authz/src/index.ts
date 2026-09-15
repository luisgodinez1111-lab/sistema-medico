
export type Principal=Readonly<{actorId:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:"TREATMENT"|"OPERATIONS"|"BILLING"|"RESEARCH"}>;
export function authorize(p:Principal,input:{tenantId:string;roles?:readonly string[];scope?:string;purpose?:Principal["purpose"]}){
 if(p.tenantId!==input.tenantId)throw new Error("AUTHZ_CROSS_TENANT");
 if(input.roles&&!input.roles.some(r=>p.roles.includes(r)))throw new Error("AUTHZ_ROLE");
 if(input.scope&&!p.scopes.includes(input.scope))throw new Error("AUTHZ_SCOPE");
 if(input.purpose&&p.purpose!==input.purpose)throw new Error("AUTHZ_PURPOSE");
 return true;
}