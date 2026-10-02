import crypto from "node:crypto";
// ENG-054 — Observability & SLO. Invariante no negociable: NO PHI en telemetría por defecto (EXEC/ENG law).
// Los eventos SLI solo llevan campos de una ALLOWLIST (ids de correlación, flujo, outcome, latencia, código,
// hash de tenant) — nunca contenido clínico ni identificadores del paciente. Puro, sin dependencias de red.

export type SafetyMetric=Readonly<{name:string;value:number;unit:string;capability:string;at:string}>;
export type SafetySlo=Readonly<{metric:string;operator:"<="|">=";threshold:number;windowMinutes:number;failure:"BLOCK_CANARY"|"ROLLBACK"|"ESCALATE"}>;
export function evaluateSlo(m:SafetyMetric,s:SafetySlo){
 const pass=s.operator==="<="?m.value<=s.threshold:m.value>=s.threshold;
 return {pass,action:pass?"NONE":s.failure};
}

// ---------- SLI catalog (ENG-054): los 8 flujos y sus indicadores. Sin PHI. ----------
export type SliFlow="auth"|"patient_open"|"autosave"|"sign"|"result_ingest"|"critical_alert"|"workflow"|"share";
export const SLI_CATALOG:Readonly<Record<SliFlow,readonly string[]>>={
 auth:["success","error","latency"],
 patient_open:["summary_latency","staleness"],
 autosave:["failure","conflict","retry"],
 sign:["success","snapshot_integrity"],
 result_ingest:["lag","failure"],
 critical_alert:["detection_to_visible"],
 workflow:["queue_lag","retry","dead_letter"],
 share:["delivery","access_failure"],
};
export type SliOutcome="success"|"error";
// Evento SLI: SOLO campos sin PHI. ENG-054-R001: trace/correlation conectan el flujo técnico sin PHI.
export type SliEvent=Readonly<{flow:SliFlow;sli:string;outcome:SliOutcome;latencyMs:number;correlationId:string;traceId:string;at:string;tenantHash?:string;code?:string}>;
// Allowlist dura: cualquier clave fuera de esto se rechaza (posible fuga de PHI).
const SLI_ALLOWED_KEYS=new Set(["flow","sli","outcome","latencyMs","correlationId","traceId","at","tenantHash","code"]);
export function assertSliPhiFree(e:Record<string,unknown>):void{
 for(const k of Object.keys(e))if(!SLI_ALLOWED_KEYS.has(k))throw new Error(`SLI event contiene un campo no permitido (posible PHI): "${k}"`);
}
// El tenant se reporta HASHEADO (correlacionable sin exponer el id crudo).
export function tenantHash(tenantId:string):string{return crypto.createHash("sha256").update(tenantId).digest("hex").slice(0,12);}

type Sink=(e:SliEvent)=>void;
const sinks:Sink[]=[];
// Suscribe un consumidor de SLIs (métricas/backends). Devuelve un des-suscriptor.
export function onSli(sink:Sink):()=>void{sinks.push(sink);return()=>{const i=sinks.indexOf(sink);if(i>=0)sinks.splice(i,1);};}
// Fallback a stdout SOLO si nadie registró un sink: cuando el runtime conecta un consumidor estructurado
// (packages/logger), ese sink se vuelve el canal y defaultEmit se aparta para no duplicar cada línea.
function defaultEmit(e:SliEvent):void{if(sinks.length>0)return;if(process.env.OBSERVABILITY_EMIT==="1")process.stdout.write(JSON.stringify({kind:"sli",...e})+"\n");}
export function emitSli(e:SliEvent):void{
 assertSliPhiFree(e as unknown as Record<string,unknown>);
 defaultEmit(e);
 for(const s of sinks){try{s(e);}catch{/* un sink defectuoso nunca debe romper el flujo clínico */}}
}
export type SliSpan=Readonly<{end:(outcome:SliOutcome,extra?:{code?:string;tenantId?:string})=>SliEvent}>;
// Abre un span temporizado; end() calcula latencia, arma el evento (PHI-free) y lo emite.
export function sliSpan(flow:SliFlow,sli:string,correlationId:string):SliSpan{
 const startedAt=Date.now();const traceId=crypto.randomUUID();
 return{end:(outcome,extra={})=>{
  const base={flow,sli,outcome,latencyMs:Math.max(0,Date.now()-startedAt),correlationId,traceId,at:new Date().toISOString()};
  const e:SliEvent={...base,...(extra.code?{code:extra.code}:{}),...(extra.tenantId?{tenantHash:tenantHash(extra.tenantId)}:{})};
  emitSli(e);return e;
 }};
}
// Mapea el topic de un comando del kernel a un flujo ENG-054 (para etiquetar el SLI del commit).
export function flowForTopic(topic:string):SliFlow{
 if(topic.includes("sign"))return "sign";
 if(topic.startsWith("result."))return "result_ingest";
 if(topic.startsWith("obligation.")||topic.startsWith("worklist"))return "workflow";
 return "autosave";
}
