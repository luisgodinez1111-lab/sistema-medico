// EPIC S-CONFIG — Evidencia física: backend de Ajustes del consultorio (vista Configuración). Singleton por tenant
// sobre el kernel event-sourced: GET (defaults, incl. horario y módulos) -> PUT (merge, If-Match) -> GET refleja lo
// guardado -> PUT parcial (merge preserva lo previo) -> PUT de horario/módulos (horas HH:MM, cierre de días, módulos
// activos con merge profundo, rechazo de hora inválida y de módulo desconocido) -> conflicto de versión (409) ->
// aislamiento por tenant -> scope faltante (403). vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const R=await import("../../apps/web/app/api/v1/office-settings/route");
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,scopes=["settings:write"]){return signSession({sub:crypto.randomUUID(),tenantId,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
async function get(t:string){const r=await R.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json() as{settings:Record<string,unknown>;version:number}};}
async function put(t:string,settings:Record<string,unknown>,ifMatch:number){const r=await R.PUT(new Request("http://l/",{method:"PUT",headers:H(t,{"idempotency-key":idem(),"if-match":String(ifMatch)}),body:JSON.stringify({settings,occurredAt:new Date().toISOString()})}));return{status:r.status,body:await r.json() as{settings:Record<string,unknown>;version:number}};}
const{result,ok,fin}=libro();
try{
 const TA=crypto.randomUUID();const phys=tok(TA);
 // 1) GET inicial: defaults + version 0
 const g0=await get(phys);ok(g0.status===200,"GET_200");
 ok(g0.body.version===0,"INITIAL_VERSION_0");
 ok(g0.body.settings.color==="#6C5CF6"&&g0.body.settings.language==="es","DEFAULTS");
 // 1b) defaults de horario (7 días; Lun 08:00-15:00 abierto; Dom cerrado) y módulos (todos activos)
 const sch0=g0.body.settings.schedule as {day:string;open:boolean;from:string;to:string}[];
 ok(Array.isArray(sch0)&&sch0.length===7,"SCHEDULE_DEFAULT_7");
 ok(sch0[0]!.day==="Lunes"&&sch0[0]!.open===true&&sch0[0]!.from==="08:00"&&sch0[0]!.to==="15:00","SCHEDULE_DEFAULT_MON");
 ok(sch0[6]!.day==="Domingo"&&sch0[6]!.open===false,"SCHEDULE_DEFAULT_SUN_CLOSED");
 const mod0=g0.body.settings.modules as Record<string,boolean>;
 ok(mod0&&mod0["Pacientes"]===true&&mod0["Facturación"]===true,"MODULES_DEFAULT_ALL_ON");
 // 2) PUT (If-Match 0) guarda info del consultorio + apariencia + prefs
 const p1=await put(phys,{officeName:"Clínica Norte",specialty:"Medicina General",color:"#16A66A",theme:"Oscuro",realtimeAlerts:false},0);
 ok(p1.status===201,"PUT_201");
 ok(p1.body.version===1,"VERSION_1");
 ok(p1.body.settings.officeName==="Clínica Norte"&&p1.body.settings.color==="#16A66A"&&p1.body.settings.realtimeAlerts===false,"PUT_APPLIED");
 // 3) GET refleja lo persistido (no defaults)
 const g1=await get(phys);ok(g1.body.version===1&&g1.body.settings.officeName==="Clínica Norte"&&g1.body.settings.theme==="Oscuro","GET_REFLECTS_SAVE");
 // 4) PUT parcial (If-Match 1): merge preserva lo previo
 const p2=await put(phys,{phone:"614 000 1111"},1);
 ok(p2.status===201&&p2.body.version===2,"PARTIAL_PUT_VERSION_2");
 ok(p2.body.settings.phone==="614 000 1111"&&p2.body.settings.officeName==="Clínica Norte"&&p2.body.settings.color==="#16A66A","MERGE_PRESERVES");
 // 4b) PUT de horario + módulos (If-Match 2): cierra Sábado, cambia Lunes a 09:00-14:00, desactiva Facturación
 const newSch=[{day:"Lunes",open:true,from:"09:00",to:"14:00"},{day:"Martes",open:true,from:"08:00",to:"15:00"},{day:"Miércoles",open:true,from:"08:00",to:"15:00"},{day:"Jueves",open:true,from:"08:00",to:"15:00"},{day:"Viernes",open:true,from:"08:00",to:"15:00"},{day:"Sábado",open:false,from:"",to:""},{day:"Domingo",open:false,from:"",to:""}];
 const p3=await put(phys,{schedule:newSch,modules:{Facturación:false}},2);
 ok(p3.status===201&&p3.body.version===3,"SCHEDULE_MODULES_PUT_VERSION_3");
 const sch3=p3.body.settings.schedule as {day:string;open:boolean;from:string;to:string}[];
 ok(sch3[0]!.from==="09:00"&&sch3[0]!.to==="14:00"&&sch3[5]!.day==="Sábado"&&sch3[5]!.open===false,"SCHEDULE_APPLIED");
 ok((p3.body.settings.modules as Record<string,boolean>)["Facturación"]===false,"MODULE_DISABLED");
 ok((p3.body.settings.modules as Record<string,boolean>)["Pacientes"]===true,"MODULE_MERGE_PRESERVES"); // partial no borra otros módulos
 // 4c) defaults de preferencias/regionales presentes en el GET inicial
 ok(g0.body.settings.prefRecordView==="Resumen clínico"&&g0.body.settings.regCurrency==="MXN"&&g0.body.settings.regTaxRate==="16","PREF_REG_DEFAULTS");
 // el merge del horario/módulos preserva la info previa del consultorio
 ok(p3.body.settings.officeName==="Clínica Norte"&&p3.body.settings.phone==="614 000 1111","SCHEDULE_MERGE_PRESERVES");
 // GET refleja horario + módulos persistidos
 const g3=await get(phys);
 ok(g3.body.version===3&&(g3.body.settings.schedule as {open:boolean}[])[5]!.open===false&&(g3.body.settings.modules as Record<string,boolean>)["Facturación"]===false,"GET_REFLECTS_SCHEDULE_MODULES");
 // rechaza hora inválida (HH:MM) en el horario -> 400 (no persiste basura)
 const badTime=await put(phys,{schedule:[{day:"Lunes",open:true,from:"25:99",to:"14:00"}]},3);
 ok(badTime.status===400,"SCHEDULE_BAD_TIME_400");
 // rechaza módulo desconocido -> 400
 const badMod=await put(phys,{modules:{Inexistente:false}},3);
 ok(badMod.status===400,"MODULE_UNKNOWN_400");
 // 4d) PUT de preferencias de consulta + regionales (If-Match 3 -> v4) con merge que preserva lo previo
 const p4=await put(phys,{prefRecordView:"Cronología",prefUnits:"Imperial (lb, in)",regState:"Chihuahua",regCity:"Chihuahua",regTaxRate:"8",regCurrency:"USD"},3);
 ok(p4.status===201&&p4.body.version===4,"PREF_REG_PUT_VERSION_4");
 ok(p4.body.settings.prefRecordView==="Cronología"&&p4.body.settings.prefUnits==="Imperial (lb, in)"&&p4.body.settings.regState==="Chihuahua"&&p4.body.settings.regTaxRate==="8"&&p4.body.settings.regCurrency==="USD","PREF_REG_APPLIED");
 ok(p4.body.settings.officeName==="Clínica Norte"&&(p4.body.settings.modules as Record<string,boolean>)["Facturación"]===false&&(p4.body.settings.schedule as {open:boolean}[])[5]!.open===false,"PREF_REG_MERGE_PRESERVES");
 // 5) conflicto de versión: If-Match desactualizado -> 409
 const stale=await put(phys,{officeName:"Otro"},1);
 ok(stale.status===409,"STALE_IFMATCH_409");
 // 6) aislamiento por tenant: otro tenant ve defaults, version 0
 const gB=await get(tok(crypto.randomUUID()));
 ok(gB.body.version===0&&gB.body.settings.officeName==="","TENANT_ISOLATION");
 // 7) scope faltante -> 403 (GET y PUT)
 const noScopeGet=await get(tok(TA,["patient:read"]));ok(noScopeGet.status===403,"GET_MISSING_SCOPE_403");
 const noScopePut=await put(tok(TA,["patient:read"]),{officeName:"X"},2);ok(noScopePut.status===403,"PUT_MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
