// Porte de SQL-2 y SQL-3 (revisión adversarial del lote 11, casos E y F de live-review-hardening-proof del origen) —
// Evidencia física: (E) el registro de resultados toma el ciclo de vida del fold (CORRECTED es anotación: un resultado
// CERRADO y luego corregido sigue CERRADO y se declara «Corregido») y los KPIs no cuentan lo reemplazado como hallazgo,
// seguimiento ni pendiente; (E') un resultado anulado (ENTERED_IN_ERROR, R03-10 de main) no aparece en el registro ni en
// los KPIs y no altera el ciclo de vida de otro; (F) el indicador glucémico declara lo que excluye. vs base desechable.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: el prólogo (_live-env) fija un secreto aleatorio por corrida
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const rVerify=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const rAction=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const rClose=await import("../../apps/web/app/api/v1/results/[resultId]/closure/route");
const rCorr=await import("../../apps/web/app/api/v1/results/[resultId]/correction/route");
const rVoid=await import("../../apps/web/app/api/v1/results/[resultId]/error-mark/route");
const tabsR=await import("../../apps/web/app/api/v1/patients/[patientId]/consultation-tabs/route");
const repR=await import("../../apps/web/app/api/v1/reports/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const phys=signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["result:write","result:read","obligation:write","patient:read","record:export"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+phys,...x};}
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const RP=(id:string)=>({params:Promise.resolve({resultId:id})});
async function receive(pat:string,analyte:string,value:string,unit:string,resultId=crypto.randomUUID()){
 const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({resultId,patientId:pat,orderId:crypto.randomUUID(),analyte,value,unit,occurredAt:at()})}));
 return{r,resultId};
}
const step=(route:{POST:(q:Request,p:{params:Promise<{resultId:string}>})=>Promise<Response>},id:string,ifMatch:number,body:Record<string,unknown>)=>
 route.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":String(ifMatch)}),body:JSON.stringify({...body,occurredAt:at()})}),RP(id));
type Item={resultId:string;lifecycle:string;estado:string;superseded:boolean};
type Reg={items:Item[];total:number;abnormal:number;enSeguimiento:number;pendientes:number};
const registry=async()=>await(await resR.GET(new Request("http://l/",{headers:H()}))).json() as Reg;
// Coherencia KPI <-> lista: el tenant de la prueba cabe en una página, así que los recuentos de la base deben coincidir con
// los de la lista aplicando la regla de los vigentes (y `total` = toda fila no anulada, como la lista).
const coherent=(g:Reg)=>{const v=g.items.filter(i=>!i.superseded);
 return g.total===g.items.length&&g.abnormal===v.filter(i=>i.estado==="Hallazgos").length
  &&g.enSeguimiento===v.filter(i=>i.lifecycle==="ACTIONED").length&&g.pendientes===v.filter(i=>i.lifecycle==="RECEIVED").length;};
try{
 // (E) Registro: un resultado CERRADO y luego corregido conserva su ciclo de vida (CLOSED) y no cuenta como pendiente.
 const tb=crypto.randomUUID();await ensurePatientIn(TA,tb);
 const n=await receive(tb,"GLUCOSE","5.5","mmol/L");
 await step(rVerify,n.resultId,1,{});await step(rAction,n.resultId,2,{ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()});await step(rClose,n.resultId,3,{evidence:"Revisado con la paciente en consulta"});
 const nc=crypto.randomUUID();const nfix=await step(rCorr,n.resultId,4,{correctedResultId:nc,value:"5.6",unit:"mmol/L",reason:"Corrección del laboratorio"});
 const reg=await registry();
 const orig=reg.items.find(i=>i.resultId===n.resultId),neu=reg.items.find(i=>i.resultId===nc);
 ok(nfix.status===201&&orig?.lifecycle==="CLOSED"&&orig.superseded===true&&orig.estado==="Corregido","CORRECTED_CLOSED_RESULT_KEEPS_FOLD_LIFECYCLE");
 ok(neu?.lifecycle==="RECEIVED"&&neu.superseded===false&&neu.estado!=="Corregido","CORRECTION_IS_THE_CURRENT_RESULT");
 // En el origen, el resultado RECIBIDO y corregido lo creaban casos de otro grupo; aquí se crea explícitamente: recibido y
 // corregido sin verificar (sigue RECEIVED, reemplazado), para que el check de pendientes compruebe algo real.
 const p=await receive(tb,"POTASSIUM","4.0","mmol/L");
 const pfix=await step(rCorr,p.resultId,1,{correctedResultId:crypto.randomUUID(),value:"4.2",unit:"mmol/L",reason:"Corrección del laboratorio"});
 ok(p.r.status===201&&pfix.status===201,"RECEIVED_RESULT_CORRECTED_WITHOUT_REVIEW");
 const regAll=await registry();
 ok(regAll.pendientes===regAll.items.filter(i=>!i.superseded&&i.lifecycle==="RECEIVED").length&&regAll.items.some(i=>i.superseded&&i.lifecycle==="RECEIVED"),"PENDING_KPI_EXCLUDES_SUPERSEDED");
 ok(coherent(regAll),"RESULT_KPIS_MATCH_LIST_OVER_CURRENT_RESULTS");
 // La pestaña de la consulta usa la MISMA regla del estado-UI que la vista Resultados.
 const tabs=await(await tabsR.GET(new Request("http://l/",{headers:H()}),{params:Promise.resolve({patientId:tb})})).json() as{results:{estado:string}[]};
 ok(tabs.results.filter(r=>r.estado==="Corregido").length===2&&tabs.results.length===4,"CONSULTATION_TAB_DECLARES_CORRECTED");
 // (E') Anulación (R03-10): un resultado anulado no está en el registro ni en los KPIs, y no cambia el ciclo de vida de otro.
 const ta=crypto.randomUUID();await ensurePatientIn(TA,ta);
 const x=await receive(ta,"CREATININE","0.9","mg/dL");const y=await receive(ta,"CREATININE","1.0","mg/dL");
 await step(rVerify,x.resultId,1,{});
 await step(rVerify,y.resultId,1,{});await step(rAction,y.resultId,2,{ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+86_400_000).toISOString()});
 const before=await registry();
 const xv=await step(rVoid,x.resultId,2,{reason:"Muestra de otro paciente: capturada en el expediente equivocado"});
 const after=await registry();const yAfter=after.items.find(i=>i.resultId===y.resultId);
 ok(xv.status===201&&!after.items.some(i=>i.resultId===x.resultId)&&after.total===before.total-1&&coherent(after)
  &&yAfter?.lifecycle==="ACTIONED"&&yAfter.estado==="En seguimiento","VOIDED_RESULT_OUT_OF_REGISTRY_AND_KPIS");
 // (F) Indicador glucémico: un valor no interpretable no se cuenta, pero se DECLARA.
 const hb=crypto.randomUUID();await ensurePatientIn(TA,hb);
 const u=await receive(hb,"HBA1C","6.5%","%");const v=await receive(hb,"HBA1C","6,4","%");
 const q=((await(await repR.GET(new Request("http://l/",{headers:H()}))).json()).qualityIndicators as{key:string;denominator:number;excluded:number;note:string}[]).find(z=>z.key==="glycemic_control")!;
 ok(u.r.status===201&&v.r.status===201&&q.denominator===1&&q.excluded===1&&/No se cuentan 1 con valor no interpretable/.test(q.note),"GLYCEMIC_QI_DECLARES_EXCLUDED_VALUES");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
