// Auditoría R01-020: la lista negra dejaba pasar campos que SÍ son PHI en este dominio (birthDate, content, addendum,
// substance, reaction, occupation, maritalStatus, title, assessment, plan, indication…). Con una lista negra, cada campo
// nuevo del dominio es una fuga en potencia. Se invierte: SOLO se dejan pasar claves técnicas de una allowlist cerrada
// (identificadores opacos, códigos, contadores, marcas de tiempo); cualquier otra clave se redacta.
const ALLOWED_KEYS=new Set([
 "event","flow","sli","outcome","code","status","statusCode","method","path","route","kind","topic","aggregateType",
 "tenantId","actorId","sessionId","requestId","correlationId","traceId","idempotencyKey","expectedVersion","version",
 "sequence","attempt","count","total","latencyMs","durationMs","retryAfterSeconds","at","occurredAt","recordedAt",
 "mode","reason","result","ok","allowed","limit","remaining","env","nodeEnv","vercelEnv","scope","scopes","role","roles",
 "purpose","actorType","migration","sha256","hash","contentHash","file","line","bytes","size","mime",
]);
// Se conserva además el patrón antiguo para nombrar explícitamente lo que jamás sale, aunque alguien añada una clave a la
// allowlist por error: un secreto redacta siempre.
const NEVER=/password|token|authorization|cookie|secret|credential|apikey|api_key|bearer/i;
export function redact(value:unknown,depth=0):unknown{
 if(depth>6)return"[REDACTED_DEPTH]";
 if(Array.isArray(value))return value.map(v=>redact(v,depth+1));
 if(value&&typeof value==="object"){const out:Record<string,unknown>={};for(const[k,v]of Object.entries(value as Record<string,unknown>))out[k]=(!ALLOWED_KEYS.has(k)||NEVER.test(k))?"[REDACTED]":redact(v,depth+1);return out;}
 return value;
}
export function safeLog(event:string,fields:Record<string,unknown>){return JSON.stringify({event,...redact(fields) as object});}
