// Auditoría 2026-09-19, anexo R06 (vacío F09, y R06-07/R06-17) — Evidencia física: el aislamiento por tenant se ejercita
// TABLA POR TABLA, no solo sobre `clinical_events`.
//
// Lo que faltaba: la única prueba real de RLS recorría una tabla (el restore drill, con clinical_events). Las 41 tablas con
// RLS se daban por aisladas porque la migración creaba la política, pero «existe una política» y «la política aísla» no son
// lo mismo: una política con un `USING` mal escrito, una tabla con RLS y SIN política (denegación total, el hallazgo R06-07)
// o una tabla que alguien añade mañana sin política pasan desapercibidas. Esta prueba escribe una fila del tenant A en cada
// tabla con RLS y comprueba que el tenant B no la ve, con el rol de la aplicación (que NO tiene BYPASSRLS).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
import postgres from"postgres";
import{directEndpoint}from"../../packages/pg-endpoint/src";
const URL_DB=process.env.TEST_DATABASE_URL!;
const A=crypto.randomUUID(),B=crypto.randomUUID();
const result:{status:string;checks:string[];error?:string;detail?:unknown}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// CLAVE de esta prueba: se conecta CON EL ROL DE LA APLICACIÓN (`medical_os_runtime`, sin BYPASSRLS), no con el dueño de
// la base. Un superusuario —o el propietario de la tabla sin FORCE— ignora las políticas: una prueba de RLS ejecutada como
// dueño pasa por la razón equivocada. El rol se toma con `-c role=...` sobre la conexión del dueño, igual que el restore
// drill, y se le concede la pertenencia si hace falta.
// El LECTOR es `medical_os_readonly`: desde el lote 12b tiene SELECT sobre las 41 tablas con RLS y NO tiene BYPASSRLS, así
// que es el único rol con el que se puede recorrer todas y comprobar la política de cada una. (Con `medical_os_runtime`, de
// privilegio mínimo, la lectura fallaría por falta de permiso en la mayoría: «no ve la fila» por la razón equivocada.)
// La ESCRITURA se hace como dueño, que sí puede insertar en cualquier tabla: lo que se prueba es la política de LECTURA.
const READER_ROLE="medical_os_readonly";
const owner=postgres(directEndpoint(URL_DB),{max:1,prepare:false,onnotice:()=>{}});
const sql=postgres(directEndpoint(URL_DB),{max:1,prepare:false,onnotice:()=>{},connection:{options:`-c role=${READER_ROLE}`}});
/** Fija el contexto de tenant como lo hace el kernel y ejecuta dentro de una transacción. */
async function comoTenant<T>(tenantId:string,fn:(tx:postgres.TransactionSql)=>Promise<T>):Promise<T>{
 return sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${tenantId},true),set_config('app.actor_id',${crypto.randomUUID()},true),set_config('app.purpose','TREATMENT',true),set_config('app.request_id',${crypto.randomUUID()},true),set_config('app.actor_type','SYSTEM',true)`;
  return fn(tx);
 }) as Promise<T>;
}
try{
 // El usuario conector debe pertenecer al rol para poder asumirlo.
 await owner.unsafe(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles g ON g.oid=m.member WHERE r.rolname='${READER_ROLE}' AND g.rolname=current_user) THEN EXECUTE format('GRANT ${READER_ROLE} TO %I',current_user); END IF; END $$;`);
 const rol=await sql`select current_user as u,(select rolbypassrls from pg_roles where rolname=current_user) as bypass`;
 ok(String(rol[0]!.u)===READER_ROLE&&rol[0]!.bypass===false,`CONNECTED_AS_READER_ROLE_WITHOUT_BYPASSRLS:${rol[0]!.u}`);
 // 1) Inventario: TODA tabla con RLS tiene al menos una política. Con RLS y sin política la tabla no es «segura»: es
 //    inservible para el rol de la aplicación (hallazgo R06-07, que así no puede reaparecer en silencio).
 const conRls=await owner`select c.relname as t,c.relforcerowsecurity as forced,
   (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as pols,
   (select count(*) from information_schema.columns k where k.table_schema='public' and k.table_name=c.relname and k.column_name='tenant_id') as has_tenant
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
    -- Auditoría R06-03/04/18/23 (migración 0028): las tablas RETIRADAS conservan su RLS y su política, pero se quedaron
    -- SIN privilegios para ningún rol, a propósito. No forman parte de la superficie de aislamiento por tenant: no hay
    -- ruta, rol ni consulta que pueda llegar a ellas. Ejercitarlas aquí solo probaría que un REVOKE funciona.
    and c.relname not like '%\_retirada\_%'
  order by c.relname`;
 // El suelo existe para que la prueba no pueda «pasar» ejercitando nada. Bajó de 40 a 35 cuando la migración 0028 retiró
 // seis tablas heredadas del esquema vigente: el número es una consecuencia declarada, no un ajuste para que pase.
 ok(conRls.length>=35,`RLS_TABLES_INVENTORY:${conRls.length}`);
 // Y se comprueba lo que de ellas SÍ importa: que ningún rol DE LA APLICACIÓN conserve privilegios sobre una tabla
 // retirada. El propietario del esquema (la cuenta del DBA) siempre los conserva —Postgres los lista y puede volver a
 // otorgarlos—, así que exigir «cero privilegios para nadie» sería exigir algo que no existe; lo que no puede haber es un
 // camino desde la aplicación.
 const retiradasConPrivilegio=await owner`select table_name||':'||grantee||':'||privilege_type as g
   from information_schema.role_table_grants
   where table_schema='public' and table_name like '%\_retirada\_%' and grantee like 'medical_os%'`;
 ok(retiradasConPrivilegio.length===0,`RETIRED_TABLES_HAVE_NO_GRANTS${retiradasConPrivilegio.length?":"+retiradasConPrivilegio.map(r=>String(r.g)).join(","):""}`);
 const sinPolitica=conRls.filter(r=>Number(r.pols)===0).map(r=>String(r.t));
 ok(sinPolitica.length===0,`NO_RLS_TABLE_WITHOUT_POLICY${sinPolitica.length?":"+sinPolitica.join(","):""}`);
 const sinForce=conRls.filter(r=>r.forced!==true).map(r=>String(r.t));
 ok(sinForce.length===0,`ALL_RLS_FORCED${sinForce.length?":"+sinForce.join(","):""}`);
 const sinTenant=conRls.filter(r=>Number(r.has_tenant)===0).map(r=>String(r.t));
 ok(sinTenant.length===0,`ALL_RLS_TABLES_HAVE_TENANT_ID${sinTenant.length?":"+sinTenant.join(","):""}`);

 // 2) Aislamiento EJERCITADO tabla por tabla: se inserta una fila mínima del tenant A y se lee desde el tenant B.
 //    Las columnas obligatorias se rellenan con valores sintéticos del tipo que la columna exige.
 const cols=await owner`select table_name as t,column_name as c,data_type as d,is_nullable as n,column_default as def
  from information_schema.columns where table_schema='public' order by table_name,ordinal_position`;
 const porTabla=new Map<string,{c:string;d:string;n:string;def:string|null}[]>();
 for(const r of cols){const k=String(r.t);porTabla.set(k,[...(porTabla.get(k)??[]),{c:String(r.c),d:String(r.d),n:String(r.n),def:r.def===null?null:String(r.def)}]);}
 const valor=(d:string,col:string,tenant:string):unknown=>{
  if(col==="tenant_id")return tenant;
  switch(d){
   case"uuid":return crypto.randomUUID();
   case"timestamp with time zone":case"timestamp without time zone":return new Date().toISOString();
   case"boolean":return false;
   case"integer":case"bigint":case"smallint":case"numeric":case"double precision":return 1;
   case"jsonb":case"json":return sql.json({kind:"RLS_PROOF"} as never);
   case"ARRAY":return[];
   default:return `rls-proof-${col}`;
  }
 };
 const probadas:string[]=[];const fugas:string[]=[];const noProbadas:string[]=[];const ciegas:string[]=[];
 for(const row of conRls){
  const t=String(row.t);const def=porTabla.get(t)??[];
  // Solo las columnas OBLIGATORIAS sin valor por omisión (lo mínimo para que el INSERT sea válido).
  const obligatorias=def.filter(c=>c.n==="NO"&&c.def===null);
  const marca=crypto.randomUUID();
  try{
   const nombres=obligatorias.map(c=>c.c);
   const valores=obligatorias.map(c=>c.c==="tenant_id"?A:valor(c.d,c.c,A));
   await owner.unsafe(`insert into ${t} (${nombres.map(n=>`"${n}"`).join(",")}) values (${nombres.map((_,i)=>`$${i+1}`).join(",")})`,valores as never[]);
  }catch{noProbadas.push(t);continue;} // forma no trivial (CHECK, FK, enum): no se fuerza; el inventario ya la cubre
  // El tenant B NO ve la fila del tenant A…
  const vistasB=await comoTenant(B,async tx=>{const r=await tx.unsafe(`select count(*)::int n from ${t} where tenant_id=$1`,[A] as never[]);return Number((r[0] as{n:number}).n);});
  // …y el tenant A SÍ la ve (sin esto, una política que niega TODO pasaría la prueba por la razón equivocada).
  const vistasA=await comoTenant(A,async tx=>{const r=await tx.unsafe(`select count(*)::int n from ${t} where tenant_id=$1`,[A] as never[]);return Number((r[0] as{n:number}).n);});
  if(vistasB>0)fugas.push(`${t}:${vistasB}`);
  else if(vistasA===0)ciegas.push(t);
  else probadas.push(t);
  void marca;
 }
 ok(fugas.length===0,`NO_CROSS_TENANT_READ${fugas.length?":"+fugas.join(","):""}`);
 ok(ciegas.length===0,`POLICY_SCOPES_NOT_DENIES_ALL${ciegas.length?":"+ciegas.join(","):""}`);
 // Mismo criterio que el suelo del inventario: el umbral existe para que la prueba no pase sin ejercitar nada, y bajó de
 // 25 a 22 porque la migración 0028 retiró del esquema vigente tres tablas que ANTES se ejercitaban aquí
 // (patient_state_projection y las dos de break-glass; las otras tres no tenían forma trivial de insertar).
 ok(probadas.length>=22,`ISOLATION_EXERCISED_ON_${probadas.length}_TABLES`);
 result.detail={tablasConRls:conRls.length,aislamientoEjercitado:probadas.length,noInsertables:noProbadas};

 // 3) Sin contexto de tenant, el rol no ve NADA (la política evalúa app.current_tenant(), que sin `set_config` es NULL).
 const sinContexto=await sql`select count(*)::int n from clinical_events`;
 ok(Number(sinContexto[0]!.n)===0,"NO_TENANT_CONTEXT_READS_NOTHING");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await sql.end();await owner.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
