import{redact}from"../../secure-logger/src";
export type LogRecord=Readonly<{level:"debug"|"info"|"warn"|"error";event:string;at:string;correlationId:string;tenantId?:string;actorId?:string;capability?:string;fields?:Readonly<Record<string,unknown>>}>;
export function serializeLog(r:LogRecord){return JSON.stringify({...r,fields:redact(r.fields)});}
