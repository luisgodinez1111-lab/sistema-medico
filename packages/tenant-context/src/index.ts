import{ClinicalError}from"../../runtime-errors/src";
export type TenantContext=Readonly<{tenantId:string;actorId:string;purpose:string;requestId:string}>;
export function assertTenantContext(x:TenantContext){for(const k of["tenantId","actorId","purpose","requestId"]as const)if(!x[k])throw new ClinicalError("SAFETY_BLOCKED",`Missing database context: ${k}`);return x;}
