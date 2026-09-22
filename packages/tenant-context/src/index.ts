import{ClinicalError}from"../../runtime-errors/src";
// Auditoría 2026-09-19 (S-06) — `actorType` es parte del contexto: el registro inmutable debe decir si el comando lo originó
// un HUMANO autenticado, una IA (a través del gateway) o el SISTEMA (trabajos sin sesión). Antes el kernel escribía 'HUMAN'
// fijo, también para comandos de la IA: atribución falsa en el registro médico-legal.
export type ActorType="HUMAN"|"AI"|"SYSTEM";
export const ACTOR_TYPES:readonly ActorType[]=["HUMAN","AI","SYSTEM"];
export type TenantContext=Readonly<{tenantId:string;actorId:string;actorType:ActorType;purpose:string;requestId:string}>;
export function assertTenantContext(x:TenantContext){
 for(const k of["tenantId","actorId","purpose","requestId"]as const)if(!x[k])throw new ClinicalError("SAFETY_BLOCKED",`Missing database context: ${k}`);
 if(!ACTOR_TYPES.includes(x.actorType))throw new ClinicalError("SAFETY_BLOCKED","Missing database context: actorType");
 return x;
}
