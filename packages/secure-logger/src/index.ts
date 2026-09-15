const SECRET_KEYS=/password|token|authorization|cookie|secret|ssn|curp|rfc|phone|email|address|name|diagnosis|note|payload/i;
export function redact(value:unknown,depth=0):unknown{
 if(depth>6)return"[REDACTED_DEPTH]";
 if(Array.isArray(value))return value.map(v=>redact(v,depth+1));
 if(value&&typeof value==="object"){const out:Record<string,unknown>={};for(const[k,v]of Object.entries(value as Record<string,unknown>))out[k]=SECRET_KEYS.test(k)?"[REDACTED]":redact(v,depth+1);return out;}
 return value;
}
export function safeLog(event:string,fields:Record<string,unknown>){return JSON.stringify({event,...redact(fields) as object});}
