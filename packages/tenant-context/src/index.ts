import{ClinicalError}from"../../runtime-errors/src";
// Auditoría 2026-09-19 (S-06) — `actorType` es parte del contexto: el registro inmutable debe decir si el comando lo originó
// un HUMANO autenticado, una IA (a través del gateway) o el SISTEMA (trabajos sin sesión). Antes el kernel escribía 'HUMAN'
// fijo, también para comandos de la IA: atribución falsa en el registro médico-legal.
export type ActorType="HUMAN"|"AI"|"SYSTEM";
export const ACTOR_TYPES:readonly ActorType[]=["HUMAN","AI","SYSTEM"];
export type TenantContext=Readonly<{tenantId:string;actorId:string;actorType:ActorType;purpose:string;requestId:string}>;
// Auditoría 2026-09-19, anexo R06 (R06-29): solo se comprobaba que los campos no fueran vacíos. Un `tenantId` malformado
// (no UUID) no se detectaba aquí: el fallo ocurría DENTRO de Postgres, al evaluar `current_setting('app.tenant_id')::uuid`
// en una política RLS, con un «invalid input syntax for type uuid» que no dice de qué comando viene ni en qué capa falló.
// Las columnas `tenant_id` y `actor_id` son `uuid`, así que el formato es parte del contrato del contexto, no un detalle.
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid=(v:string):boolean=>UUID_RE.test(v.trim());
export function assertTenantContext(x:TenantContext){
 for(const k of["tenantId","actorId","purpose","requestId"]as const)if(!x[k])throw new ClinicalError("SAFETY_BLOCKED",`Missing database context: ${k}`);
 if(!ACTOR_TYPES.includes(x.actorType))throw new ClinicalError("SAFETY_BLOCKED","Missing database context: actorType");
 // R06-29: falla ANTES de tocar la base, con el campo y el valor a la vista.
 for(const k of["tenantId","actorId"]as const)
  if(!isUuid(x[k]))throw new ClinicalError("SAFETY_BLOCKED",`Invalid database context: ${k} no es un UUID («${x[k]}»). Las columnas tenant_id y actor_id son uuid y la política RLS lo castea: un valor malformado falla dentro de Postgres, no aquí.`,{field:k});
 return x;
}
