// Auditoría 2026-09-19, anexo R06 (vacío F09, y R06-07/R06-17) — Evidencia física: el aislamiento por tenant se ejercita
// TABLA POR TABLA, no solo sobre `clinical_events`.
//
// Lo que faltaba: la única prueba real de RLS recorría una tabla (el restore drill, con clinical_events). Las tablas con RLS
// se daban por aisladas porque la migración creaba la política, pero «existe una política» y «la política aísla» no son
// lo mismo: una política con un `USING` mal escrito, una tabla con RLS y SIN política (denegación total, el hallazgo R06-07)
// o una tabla que alguien añade mañana sin política pasan desapercibidas. Esta prueba escribe una fila del tenant A en cada
// tabla con RLS y comprueba que el tenant B no la ve, con el rol de la aplicación (que NO tiene BYPASSRLS).
//
// Lote 15 (25-sep-2026), al quitarle los dos umbrales escritos a mano: la prueba decía «tabla por tabla» y ejercitaba 20 de
// 33, porque la fila sintética se construía con texto genérico (`rls-proof-status`) y las TRECE tablas con un CHECK de
// valores admitidos —patients, encounters, medications, diagnostic_results, outbox, command_idempotency, clinical_inbox,
// audit_ledger, audit_chain_v3, clinical_amendments, encounter_signatures, ai_execution_receipts, idempotency_keys— caían a
// un saco silencioso de «no insertables». Es decir: las tablas con PHI, las que el aislamiento por tenant existe para
// proteger, eran justo las que no se comprobaban, y el umbral `>=22` seguía en verde porque lo sostenían las auxiliares.
// Ahora el valor sintético se deriva del CHECK de la columna, las columnas generadas se excluyen y el texto lleva marca de
// corrida (sin ella, el segundo run chocaba con los índices únicos): 33 de 33.
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
// El LECTOR es `medical_os_readonly`: desde el lote 12b tiene SELECT sobre todas las tablas con RLS y NO tiene BYPASSRLS, así
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
 // El inventario se contrasta contra las migraciones del repositorio (tablas creadas menos tablas retiradas), que son la
 // única definición del esquema vigente, y NO contra un número escrito a mano. Un número a mano se calibra contra la base
 // que uno tiene delante, y eso ya falló: el suelo decía 35 porque el clúster efímero de la sesión había acumulado dos
 // tablas de una versión anterior de las migraciones; una base recién migrada da 33, y el fallo no era del esquema sino del
 // número. Derivado, añadir o retirar una tabla lo ajusta solo, y una tabla que aparezca en la base sin estar en ninguna
 // migración se ve como lo que es: deriva de esquema.
 const {readMigrationFiles,createdTables,retiredTables}=await import("../../packages/db-migrations/src");
 const migraciones=readMigrationFiles();
 const creadas=new Set(migraciones.flatMap(f=>createdTables(f.body)));
 const retiradas=new Set(migraciones.flatMap(f=>retiredTables(f.body)));
 const vigentes=[...creadas].filter(t=>!retiradas.has(t));
 // Las tablas sin `tenant_id` (evidencia, cubos de límite, control de migraciones) no llevan RLS por diseño, así que el
 // techo son las tablas vigentes y el suelo es que haya alguna: lo que esta comprobación impide es un inventario vacío
 // —una prueba que «pasa» sin recorrer nada— y un inventario mayor que el esquema que el repositorio define.
 ok(conRls.length>0&&conRls.length<=vigentes.length,`RLS_TABLES_INVENTORY:${conRls.length} vigentes_en_migraciones:${vigentes.length}`);
 // Y la invariante que de verdad importa: ninguna tabla con RLS en la base puede faltar en las migraciones (sería deriva).
 const fueraDeMigraciones=conRls.map(r=>String(r.t)).filter(t=>!creadas.has(t));
 ok(fueraDeMigraciones.length===0,`RLS_TABLE_NOT_IN_MIGRATIONS:${fueraDeMigraciones.join(",")}`);
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
 const cols=await owner`select table_name as t,column_name as c,data_type as d,is_nullable as n,column_default as def,
   is_generated as gen,is_identity as ident
  from information_schema.columns where table_schema='public' order by table_name,ordinal_position`;
 const porTabla=new Map<string,{c:string;d:string;n:string;def:string|null;gen:string;ident:string}[]>();
 for(const r of cols){const k=String(r.t);porTabla.set(k,[...(porTabla.get(k)??[]),{c:String(r.c),d:String(r.d),n:String(r.n),def:r.def===null?null:String(r.def),gen:String(r.gen),ident:String(r.ident)}]);}
 // Restricciones CHECK del catálogo. Hacen falta porque la fila sintética tiene que ser VÁLIDA, no solo del tipo correcto:
 // `status='rls-proof-status'` es un texto perfecto que ninguna tabla con un CHECK de valores admitidos acepta. Esto es lo
 // que antes mandaba las trece tablas centrales —patients, encounters, medications, diagnostic_results…— al saco de «no
 // insertables», es decir, fuera de la comprobación de aislamiento que esta prueba existe para hacer.
 const checks=await owner`select conrelid::regclass::text as t,pg_get_constraintdef(oid) as def
  from pg_constraint where contype='c' and connamespace='public'::regnamespace`;
 const checksPorTabla=new Map<string,string[]>();
 for(const r of checks){const k=String(r.t).replace(/^public\./,"").replace(/"/g,"");checksPorTabla.set(k,[...(checksPorTabla.get(k)??[]),String(r.def)]);}
 /** Primer literal ADMITIDO por un CHECK que restringe esta columna (`status = ANY (ARRAY['OPEN'::text,…])` → `OPEN`). */
 const literalAdmitido=(t:string,col:string):string|undefined=>{
  for(const d of checksPorTabla.get(t)??[]){
   if(!new RegExp(`\\b${col}\\b`).test(d))continue;
   const lits=[...d.matchAll(/'([^']*)'/g)].map(x=>x[1]!).filter(v=>v.length>0);
   if(lits.length)return lits[0];
  }
  return undefined;
 };
 // Marca única del run: los valores de texto tienen que ser distintos en cada ejecución. Sin esto la prueba dependía de
 // cuántas veces se había corrido antes sobre la misma base: el primer run insertaba `rls-proof-hash` y el segundo chocaba
 // con el índice único (23505 en audit_ledger, clinical_amendments y encounter_signatures). Un resultado que cambia con el
 // número de ejecuciones no es evidencia.
 const RUN=crypto.randomUUID().slice(0,8);
 const valor=(t:string,d:string,col:string,tenant:string):unknown=>{
  if(col==="tenant_id")return tenant;
  const lit=literalAdmitido(t,col);
  switch(d){
   case"uuid":return crypto.randomUUID();
   case"timestamp with time zone":case"timestamp without time zone":return new Date().toISOString();
   case"date":return new Date().toISOString().slice(0,10);
   case"boolean":return false;
   case"integer":case"bigint":case"smallint":case"numeric":case"double precision":return 1;
   case"jsonb":case"json":return sql.json({kind:"RLS_PROOF"} as never);
   case"ARRAY":return[];
   // El literal del CHECK gana sobre el texto genérico; si el CHECK no da ninguno, el texto lleva la marca del run.
   default:return lit??`rls-proof-${col}-${RUN}`;
  }
 };
 const probadas:string[]=[];const fugas:string[]=[];const noProbadas:string[]=[];const ciegas:string[]=[];
 const motivoNoInsertable=new Map<string,string>();
 for(const row of conRls){
  const t=String(row.t);const def=porTabla.get(t)??[];
  // Solo las columnas OBLIGATORIAS sin valor por omisión (lo mínimo para que el INSERT sea válido), y NUNCA las generadas:
  // una columna `GENERATED ALWAYS` es obligatoria y sin `default`, pero Postgres rechaza cualquier valor para ella (428C9,
  // que es lo que dejaba a audit_chain_v3 sin ejercitar).
  const obligatorias=def.filter(c=>c.n==="NO"&&c.def===null&&c.gen!=="ALWAYS"&&c.ident!=="YES");
  const marca=crypto.randomUUID();
  try{
   const nombres=obligatorias.map(c=>c.c);
   const valores=obligatorias.map(c=>c.c==="tenant_id"?A:valor(t,c.d,c.c,A));
   await owner.unsafe(`insert into ${t} (${nombres.map(n=>`"${n}"`).join(",")}) values (${nombres.map((_,i)=>`$${i+1}`).join(",")})`,valores as never[]);
  }catch(e){
   // Forma no trivial (CHECK compuesto, FK obligatoria, dominio con formato): no se fuerza el INSERT, pero tampoco se
   // ignora en silencio. Se anota el SQLSTATE que Postgres devolvió para que la declaración de más abajo sea comprobable.
   noProbadas.push(t);motivoNoInsertable.set(t,String((e as{code?:string}).code??"?"));continue;
  }
  // El tenant B NO ve la fila del tenant A…
  const vistasB=await comoTenant(B,async tx=>{const r=await tx.unsafe(`select count(*)::int n from ${t} where tenant_id=$1`,[A] as never[]);return Number((r[0] as{n:number}).n);});
  // …y el tenant A SÍ la ve (sin esto, una política que niega TODO pasaría la prueba por la razón equivocada).
  const vistasA=await comoTenant(A,async tx=>{const r=await tx.unsafe(`select count(*)::int n from ${t} where tenant_id=$1`,[A] as never[]);return Number((r[0] as{n:number}).n);});
  if(vistasB>0)fugas.push(`${t}:${vistasB}`);
  else if(vistasA===0)ciegas.push(t);
  else probadas.push(t);
  void marca;
 }
 // El detalle se fija ANTES de las comprobaciones: si una falla, el lector necesita ver el inventario que la produjo, no un
 // objeto vacío. Una prueba que solo dice «FAIL» obliga a reproducirla a mano para entenderla.
 result.detail={tablasConRls:conRls.length,aislamientoEjercitado:probadas.length,
  noInsertables:noProbadas.map(t=>`${t}:${motivoNoInsertable.get(t)??"?"}`),vigentesEnMigraciones:vigentes.length};
 ok(fugas.length===0,`NO_CROSS_TENANT_READ${fugas.length?":"+fugas.join(","):""}`);
 ok(ciegas.length===0,`POLICY_SCOPES_NOT_DENIES_ALL${ciegas.length?":"+ciegas.join(","):""}`);
 // Antes había aquí un umbral a mano (`probadas.length>=22`, antes 25). Un umbral así tiene dos defectos y los dos se
 // materializaron: se recalibra cada vez que el esquema cambia —y recalibrar un umbral para que pase es indistinguible de
 // aflojar la prueba—, y sobre todo NO ve lo único que de verdad importa aquí: que una tabla deje de ejercitarse. Si mañana
 // una tabla con RLS gana un CHECK que el INSERT sintético no satisface, cae a `noProbadas`, el aislamiento de esa tabla
 // deja de comprobarse y el umbral sigue en verde porque otras 21 lo sostienen.
 // Ahora la salida silenciosa no existe: toda tabla con RLS se ejercita, o está DECLARADA aquí con la razón por la que no
 // admite una fila sintética mínima. Una tabla nueva que no se pueda insertar rompe la prueba hasta que alguien decida
 // conscientemente qué hacer con ella.
 const NO_INSERTABLES:Record<string,string>={};
 const noDeclaradas=noProbadas.filter(t=>!(t in NO_INSERTABLES));
 ok(noDeclaradas.length===0,`UNDECLARED_NON_INSERTABLE${noDeclaradas.length?":"+noDeclaradas.map(t=>`${t}(${motivoNoInsertable.get(t)})`).join(","):""}`);
 // Y la simétrica: una declaración que ya no aplica —la tabla sí se pudo insertar, o desapareció del esquema— se retira.
 // Sin esto la lista crecería para siempre y acabaría siendo una lista de exenciones que nadie revisa.
 const presentes=new Set(conRls.map(r=>String(r.t)));
 const obsoletas=Object.keys(NO_INSERTABLES).filter(t=>probadas.includes(t)||!presentes.has(t));
 ok(obsoletas.length===0,`OBSOLETE_NON_INSERTABLE_DECLARATION${obsoletas.length?":"+obsoletas.join(","):""}`);
 // El número deja de ser un suelo y pasa a ser una consecuencia: ejercitadas = con RLS − declaradas no insertables.
 ok(probadas.length>0&&probadas.length===conRls.length-noProbadas.length,
  `ISOLATION_EXERCISED_ON_${probadas.length}_OF_${conRls.length}_RLS_TABLES`);

 // 3) Sin contexto de tenant, el rol no ve NADA (la política evalúa app.current_tenant(), que sin `set_config` es NULL).
 const sinContexto=await sql`select count(*)::int n from clinical_events`;
 ok(Number(sinContexto[0]!.n)===0,"NO_TENANT_CONTEXT_READS_NOTHING");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await sql.end();await owner.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
