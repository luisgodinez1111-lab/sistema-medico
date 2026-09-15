
export type Span=Readonly<{traceId:string;spanId:string;name:string;startedAt:number;attributes:Readonly<Record<string,string|number|boolean>>}>;
export function startSpan(name:string,attributes:Span["attributes"]={}):Span{return Object.freeze({traceId:crypto.randomUUID(),spanId:crypto.randomUUID(),name,startedAt:Date.now(),attributes});}
import crypto from "node:crypto";
