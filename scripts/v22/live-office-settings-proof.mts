// EPIC S-CONFIG — Evidencia física: backend de Ajustes del consultorio (vista Configuración). Singleton por tenant
// sobre el kernel event-sourced: GET (defaults) -> PUT (merge, If-Match) -> GET refleja lo guardado -> PUT parcial
// (merge preserva lo previo) -> conflicto de versión (409) -> aislamiento por tenant -> scope faltante (403). vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-sconfig-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const R=await import("../../apps/web/app/api/v1/office-settings/route");
const now=Math.floor(Date.now()/1000);
function tok(tenantId:string,scopes=["settings:write"]){return signSession({sub:crypto.randomUUID(),tenantId,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
async function get(t:string){const r=await R.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json() as{settings:Record<string,unknown>;version:number}};}
async function put(t:string,settings:Record<string,unknown>,ifMatch:number){const r=await R.PUT(new Request("http://l/",{method:"PUT",headers:H(t,{"idempotency-key":idem(),"if-match":String(ifMatch)}),body:JSON.stringify({settings,occurredAt:new Date().toISOString()})}));return{status:r.status,body:await r.json() as{settings:Record<string,unknown>;version:number}};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const TA=crypto.randomUUID();const phys=tok(TA);
 // 1) GET inicial: defaults + version 0
 const g0=await get(phys);ok(g0.status===200,"GET_200");
 ok(g0.body.version===0,"INITIAL_VERSION_0");
 ok(g0.body.settings.color==="#6C5CF6"&&g0.body.settings.language==="es","DEFAULTS");
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
 // 5) conflicto de versión: If-Match desactualizado -> 409
 const stale=await put(phys,{officeName:"Otro"},1);
 ok(stale.status===409,"STALE_IFMATCH_409");
 // 6) aislamiento por tenant: otro tenant ve defaults, version 0
 const gB=await get(tok(crypto.randomUUID()));
 ok(gB.body.version===0&&gB.body.settings.officeName==="","TENANT_ISOLATION");
 // 7) scope faltante -> 403 (GET y PUT)
 const noScopeGet=await get(tok(TA,["patient:read"]));ok(noScopeGet.status===403,"GET_MISSING_SCOPE_403");
 const noScopePut=await put(tok(TA,["patient:read"]),{officeName:"X"},2);ok(noScopePut.status===403,"PUT_MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
