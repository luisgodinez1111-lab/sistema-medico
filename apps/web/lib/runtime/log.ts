// Observabilidad — logging ESTRUCTURADO del runtime (ENG-054). Unifica los logs del borde en el formato de
// packages/logger (LogRecord → JSON con `redact()`, PHI-free por construcción) en lugar de `console.error` sueltos
// con forma libre que ningún agregador puede parsear igual. Además conecta UNA vez el consumidor de SLIs: cuando
// OBSERVABILITY_EMIT=1, cada SLI (ya PHI-free) sale por ESTE mismo canal estructurado; al haber un sink registrado,
// el `defaultEmit` de observability se aparta para no duplicar la línea.
import{serializeLog,type LogRecord}from"../../../../packages/logger/src";
import{onSli,type SliEvent}from"../../../../packages/observability/src";

export function logEvent(level:LogRecord["level"],event:string,correlationId:string,fields?:Readonly<Record<string,unknown>>):void{
 const rec:LogRecord={level,event,at:new Date().toISOString(),correlationId,...(fields?{fields}:{})};
 const line=serializeLog(rec);
 // Errores/avisos SIEMPRE visibles (stderr); la telemetría informativa solo con el flag (no ensucia prod por defecto).
 if(level==="error"||level==="warn")process.stderr.write(line+"\n");
 else if(process.env.OBSERVABILITY_EMIT==="1")process.stdout.write(line+"\n");
}

let sinkRegistered=false;
// Idempotente. Se llama al cargar el pipeline de comandos para que los SLIs tengan un consumidor estructurado.
export function ensureObservabilitySink():void{
 if(sinkRegistered)return;sinkRegistered=true;
 onSli((e:SliEvent)=>{
  logEvent(e.outcome==="error"?"warn":"info",`sli.${e.flow}.${e.sli}`,e.correlationId,{
   outcome:e.outcome,latencyMs:e.latencyMs,...(e.code?{code:e.code}:{}),...(e.tenantHash?{tenantHash:e.tenantHash}:{}),
  });
 });
}
