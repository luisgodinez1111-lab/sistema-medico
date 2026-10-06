// Auditoría 2026-09-19, anexo R06 (R06-F13) y R11 — LAS HERRAMIENTAS DE OPERACIÓN QUE NADIE HABÍA EJECUTADO.
//
// MEDIDO el 25-sep-2026: `phi-retention`, `outbox-purge`, `idempotency-purge` y `verify-audit-chain` existen en
// `scripts/ops/` con su entrada en `package.json`, y **ninguna estaba ejercitada por una sola prueba**. Es el patrón que ya
// costó caro en R06-F12: el drill de restauración tampoco se ejecutaba y, la primera vez que corrió, tenía dos defectos —uno
// de ellos un `ReferenceError` en el camino de reconstrucción—. Una herramienta de operación no ejecutada es una herramienta
// que no se sabe si funciona, y se descubre el día que hace falta.
//
// R06-F13 — VERIFICACIÓN INDEPENDIENTE. El verificador recalcula la huella EN LA BASE con la misma expresión que la escribió:
// detecta una fila alterada, pero si la expresión tuviera un defecto estaría en los dos lados. Esta prueba añade el camino
// independiente —recálculo en Node— y el ANCLA fuera de la base, que es lo que detecta una reescritura completa de la cadena.
import crypto from"node:crypto";
import{spawnSync}from"node:child_process";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{directEndpoint}=await import("../../packages/pg-endpoint/src");
const postgres=(await import("postgres")).default;
const{verifyTenantAuditChain,verifyChainIndependently,verifyAgainstAnchor,verifyChain,pgJsonbText,AUDIT_GENESIS}=
 await import("../../packages/audit-verifier/src");
const URL_DB=process.env.TEST_DATABASE_URL!;
const owner=postgres(directEndpoint(URL_DB),{max:2,prepare:false,onnotice:()=>{}});
const TA=crypto.randomUUID();
const sha256=(s:string)=>crypto.createHash("sha256").update(Buffer.from(s,"utf8")).digest("hex");
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const ctx={tenantId:TA,actorId:crypto.randomUUID(),purpose:"OPERATIONS",requestId:crypto.randomUUID()};
/** Añade una entrada a la cadena con la MISMA función que usa el kernel. */
async function anotar(action:string,payload:Record<string,unknown>):Promise<string>{
 // La función exige el CONTEXTO de tenant: escribir en la cadena de otro tenant del que se declara es precisamente lo que
 // impide (`TENANT_CONTEXT_MISMATCH`). Se fija en la misma transacción, como hace el kernel.
 return await owner.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${TA},true),set_config('app.actor_id',${ctx.actorId},true),
   set_config('app.purpose','OPERATIONS',true),set_config('app.request_id',${crypto.randomUUID()},true)`;
  const r=await tx`select app.append_audit_v17(${TA},${crypto.randomUUID()},${ctx.actorId},${action},'Prueba',${tx.json(payload as never)}) as h`;
  return String((r[0] as{h:string}).h);
 }) as unknown as string;
}
const filas=async()=>await owner`select sequence::int as sequence,id,tenant_id,previous_hash,actor_id,action,resource,payload,entry_hash
 from audit_chain_v3 where tenant_id=${TA} order by sequence` as unknown as ReadonlyArray<Record<string,unknown>>;

try{
 // R06-06 (migración 0030): `audit_chain_v3` y `audit_chain_heads` referencian ahora `tenants`, así que el tenant de esta
 // prueba se REGISTRA antes de anotar. Es lo que la clave foránea existe para imponer: no puede haber una entrada de
 // auditoría de un consultorio que no esté dado de alta. El kernel lo registra en su primera escritura; aquí se llama a la
 // función de la cadena directamente, saltándose el kernel.
 await owner`insert into tenants(id,name) values(${TA},'Tenant de prueba de auditoría') on conflict (id) do nothing`;

 // 1) LA SERIALIZACIÓN jsonb DE POSTGRESQL, reproducida en Node y comprobada contra el motor. Si esto no coincidiera, la
 //    verificación independiente sería imposible y habría que decirlo en vez de fingirla.
 for(const v of [
  {id:"b",actor:"c",action:"X",tenant:"a",payload:{commandId:"k",eventId:"e"},resource:"R",sequence:3,previousHash:"GENESIS"},
  {a:1,bb:"dos",ccc:[1,2,"tres"],dddd:null,eeeee:true},
  {z:"z",y:{anidado:{profundo:"sí"}},x:[]},
 ]){
  const delMotor=String(((await owner`select ${owner.json(v as never)}::jsonb::text as t`)[0] as{t:string}).t);
  ok(pgJsonbText(v)===delMotor,`NODE_JSONB_MATCHES_POSTGRES:${JSON.stringify(v).slice(0,30)}`);
 }
 // Y un número de escala desconocida se RECHAZA en vez de darse por bueno.
 let rechazo=false;try{pgJsonbText({x:1.5});}catch{rechazo=true;}
 ok(rechazo,"NON_INTEGER_NUMBER_IS_REFUSED_NOT_GUESSED");

 // 2) LA CADENA se verifica por los DOS caminos y coinciden.
 const h1=await anotar("CLINICAL_COMMAND",{commandId:crypto.randomUUID(),eventId:crypto.randomUUID()});
 await anotar("CLINICAL_COMMAND",{commandId:crypto.randomUUID(),eventId:crypto.randomUUID()});
 const h3=await anotar("EXPORT",{manifest:"sha256:abc"});
 const enBase=await verifyTenantAuditChain(owner,ctx);
 ok(enBase.ok&&enBase.checked===3,`CHAIN_VERIFIED_IN_DATABASE:${enBase.checked}`);
 const rows=await filas();
 const contenido=rows.map(r=>({sequence:Number(r["sequence"]),id:String(r["id"]),tenantId:String(r["tenant_id"]),
  previousHash:String(r["previous_hash"]??""),actorId:String(r["actor_id"]),action:String(r["action"]),
  resource:String(r["resource"]),payload:r["payload"],entryHash:String(r["entry_hash"])}));
 const indep=verifyChainIndependently(contenido,sha256);
 ok(indep.ok&&indep.independentlyConfirmed===3&&indep.mismatches.length===0,
  `CHAIN_VERIFIED_INDEPENDENTLY_IN_NODE:${indep.independentlyConfirmed}/${indep.checked}`);
 ok(indep.notIndependentlyVerifiable.length===0,"NO_ROW_ESCAPES_INDEPENDENT_VERIFICATION");
 ok(contenido[0]!.previousHash===AUDIT_GENESIS,"CHAIN_STARTS_AT_GENESIS");
 void h1;

 // 3) LA CADENA ES APPEND-ONLY EN LA BASE, y eso es más fuerte de lo que el anexo suponía: un `UPDATE` o un `DELETE` se
 //    rechazan INCLUSO PARA EL PROPIETARIO del esquema. No es una convención del código: es un disparador de la base.
 let bloqueoUpdate="";
 try{await owner`update audit_chain_v3 set payload=${owner.json({commandId:"MANIPULADO"} as never)} where tenant_id=${TA} and sequence=2`;}
 catch(e){bloqueoUpdate=String((e as{message?:string}).message??e);}
 ok(/APPEND_ONLY/.test(bloqueoUpdate),`CHAIN_REFUSES_UPDATE_EVEN_TO_OWNER:${bloqueoUpdate.slice(0,60)}`);
 let bloqueoDelete="";
 try{await owner`delete from audit_chain_v3 where tenant_id=${TA} and sequence=2`;}
 catch(e){bloqueoDelete=String((e as{message?:string}).message??e);}
 ok(/APPEND_ONLY/.test(bloqueoDelete),`CHAIN_REFUSES_DELETE_EVEN_TO_OWNER:${bloqueoDelete.slice(0,60)}`);

 // 4) LA DETECCIÓN, sobre filas sintéticas. Como la base no deja manipular la cadena, la manipulación se ejercita sobre el
 //    verificador puro: es la única forma de comprobar que DETECTARÍA lo que la base impide, sin desactivar la barrera para
 //    probarla (desactivarla sería exactamente lo que un atacante necesita, y no es algo que un gate deba practicar).
 {
  const reales=(await filas()).map(r=>({sequence:Number(r["sequence"]),id:String(r["id"]),tenantId:String(r["tenant_id"]),
   previousHash:String(r["previous_hash"]??""),actorId:String(r["actor_id"]),action:String(r["action"]),
   resource:String(r["resource"]),payload:r["payload"],entryHash:String(r["entry_hash"])}));
  // Payload alterado sin recalcular la huella: es lo que haría quien edita una fila.
  const conPayloadAlterado=reales.map(r=>r.sequence===2?{...r,payload:{commandId:"MANIPULADO"}}:r);
  const d1=verifyChainIndependently(conPayloadAlterado,sha256);
  ok(!d1.ok&&d1.mismatches.includes(2),`TAMPERED_PAYLOAD_DETECTED_INDEPENDENTLY:${d1.mismatches.join(",")}`);
  // Enlace roto: la huella previa no corresponde a la entrada anterior.
  const conEnlaceRoto=reales.map(r=>r.sequence===3?{...r,previousHash:sha256("otro")}:r);
  const d2=verifyChain(conEnlaceRoto.map(r=>({sequence:r.sequence,previousHash:r.previousHash,entryHash:r.entryHash,recomputedHash:r.entryHash})));
  ok(!d2.ok&&d2.ok===false&&d2.reason==="LINK_MISMATCH",`BROKEN_LINK_DETECTED:${JSON.stringify(d2)}`);
  // Hueco en la secuencia: falta una entrada del medio.
  const conHueco=reales.filter(r=>r.sequence!==2);
  const d3=verifyChain(conHueco.map(r=>({sequence:r.sequence,previousHash:r.previousHash,entryHash:r.entryHash,recomputedHash:r.entryHash})));
  ok(!d3.ok&&d3.ok===false&&d3.reason==="SEQUENCE_GAP",`SEQUENCE_GAP_DETECTED:${JSON.stringify(d3)}`);

  // EL ANCLA detecta lo que ninguna verificación interna puede: una reescritura COMPLETA y consistente, donde todas las
  // huellas se recalculan y la cadena queda íntegra consigo misma.
  const ancla={tenantId:TA,sequence:3,entryHash:h3,anchoredAt:new Date().toISOString()};
  const vivas=reales.map(r=>({sequence:r.sequence,entryHash:r.entryHash}));
  ok(verifyAgainstAnchor(vivas,ancla).ok,"ANCHOR_MATCHES_LIVE_CHAIN");
  const reescrita=vivas.map(r=>({...r,entryHash:sha256("cadena-reescrita-"+r.sequence)}));
  const v=verifyAgainstAnchor(reescrita,ancla);
  ok(!v.ok&&v.reason==="ANCHOR_HASH_MISMATCH",`ANCHOR_DETECTS_REWRITTEN_CHAIN:${String(v.reason)}`);
  // Y una cadena TRUNCADA se distingue de un hueco: perder el final no es lo mismo que perder una fila del medio.
  ok(verifyAgainstAnchor(vivas.filter(r=>r.sequence<3),ancla).reason==="CHAIN_SHORTER_THAN_ANCHOR","ANCHOR_DETECTS_TRUNCATION");
 }

 // 5) LAS HERRAMIENTAS DE OPERACIÓN, ejecutadas. Es la primera vez que corren en un gate.
 const correr=(script:string,args:string[]=[])=>{
  const r=spawnSync("pnpm",["-s","exec","tsx",`scripts/ops/${script}`,...args],
   {encoding:"utf8",env:{...process.env,DATABASE_URL:URL_DB}});
  return{code:r.status,out:(r.stdout??"")+(r.stderr??"")};
 };
 // El informe de retención de PHI, sobre el tenant de esta prueba. Es SOLO LECTURA por diseño (ADR-0280): la purga física
 // exige decisiones del dueño, y la herramienta informa sin ejecutar nada.
 const ret=correr("phi-retention.mts",["--tenant",TA,"--json"]);
 ok(ret.code===0,`PHI_RETENTION_RUNS:${ret.code} ${ret.out.slice(0,140)}`);
 ok(/retention|retenci|patients|pacientes/i.test(ret.out),`PHI_RETENTION_REPORTS_SOMETHING:${ret.out.slice(0,80)}`);
 // Y SIN argumentos rechaza con el uso, en vez de hacer algo por omisión sobre una base de producción.
 ok(correr("phi-retention.mts").code===2,"PHI_RETENTION_REFUSES_WITHOUT_TENANT");

 // La purga de idempotencia: sin `--yes` SIMULA. Que la simulación sea el comportamiento por omisión es lo que hace segura
 // una herramienta destructiva en manos de un operador con prisa.
 const idemSim=correr("idempotency-purge.mts",["--older-than-days","30"]);
 ok(idemSim.code===0,`IDEMPOTENCY_PURGE_DRY_RUN:${idemSim.code} ${idemSim.out.slice(0,100)}`);
 ok(correr("idempotency-purge.mts").code===2,"IDEMPOTENCY_PURGE_REFUSES_WITHOUT_WINDOW");
 // Con `--yes` borra de verdad. Se comprueba que una clave CADUCADA desaparece y una VIGENTE no: una purga que se lleve
 // claves vivas rompería la idempotencia de reintentos en vuelo.
 const viva=crypto.randomUUID(),caduca=crypto.randomUUID();
 const actor=crypto.randomUUID();
 await owner`insert into command_idempotency(tenant_id,actor_id,key,request_hash,status,expires_at)
  values(${TA},${actor},${viva},'h','COMPLETED',now()+interval '1 hour'),
        (${TA},${actor},${caduca},'h','COMPLETED',now()-interval '60 days')`;
 const idemReal=correr("idempotency-purge.mts",["--older-than-days","30","--yes"]);
 ok(idemReal.code===0,`IDEMPOTENCY_PURGE_EXECUTES:${idemReal.code} ${idemReal.out.slice(0,100)}`);
 const quedan=await owner`select key from command_idempotency where tenant_id=${TA} and key in (${viva},${caduca})`;
 ok(quedan.length===1&&String((quedan[0] as{key:string}).key)===viva,
  `PURGE_REMOVES_EXPIRED_KEEPS_LIVE:${quedan.length}`);

 // La purga del outbox exige ventana y confirmación explícita.
 ok(correr("outbox-purge.mts").code===2,"OUTBOX_PURGE_REFUSES_WITHOUT_WINDOW");
 const opurge=correr("outbox-purge.mts",["--older-than-days","30","--yes"]);
 ok(opurge.code===0,`OUTBOX_PURGE_EXECUTES:${opurge.code} ${opurge.out.slice(0,100)}`);
 // El verificador con un uuid inválido tiene que RECHAZAR, no reventar: es la interfaz con un operador bajo presión.
 const malUso=correr("verify-audit-chain.mts",["no-es-uuid"]);
 ok(malUso.code===2,`AUDIT_VERIFY_REJECTS_BAD_INPUT:${malUso.code}`);
 // Y sobre un tenant sin cadena devuelve íntegra con cero comprobadas, en vez de fallar: vacío no es roto.
 const vacio=correr("verify-audit-chain.mts",[crypto.randomUUID()]);
 ok(vacio.code===0&&/"checked": 0/.test(vacio.out),`AUDIT_VERIFY_EMPTY_CHAIN_IS_INTACT:${vacio.code}`);
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await owner.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
