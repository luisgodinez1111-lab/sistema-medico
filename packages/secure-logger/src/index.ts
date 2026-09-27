const SECRET_KEYS=/password|token|authorization|cookie|secret|ssn|curp|rfc|phone|email|address|name|diagnosis|note|payload/i;
export function redact(value:unknown,depth=0):unknown{
 if(depth>6)return"[REDACTED_DEPTH]";
 if(Array.isArray(value))return value.map(v=>redact(v,depth+1));
 if(value&&typeof value==="object"){const out:Record<string,unknown>={};for(const[k,v]of Object.entries(value as Record<string,unknown>))out[k]=SECRET_KEYS.test(k)?"[REDACTED]":redact(v,depth+1);return out;}
 return value;
}
// Hallazgo D12c del lote 11: safeLog construía la línea y nadie la escribía, así que inicios de sesión, límite de tasa del login
// y banderas de identidad de desarrollo en producción no dejaban rastro. Ahora EMITE una línea JSON (ya redactada) por evento
// al sumidero; por defecto la salida estándar del proceso, que la plataforma recoge. Sigue devolviendo la línea.
export type LogSink=(line:string)=>void;
let sink:LogSink=line=>{console.info(line);};
// Sustituye el sumidero (pruebas, o un transporte dedicado) y devuelve el anterior para restaurarlo.
export function setLogSink(next:LogSink):LogSink{const prev=sink;sink=next;return prev;}
export function safeLog(event:string,fields:Record<string,unknown>){const line=JSON.stringify({event,...redact(fields) as object});sink(line);return line;}
