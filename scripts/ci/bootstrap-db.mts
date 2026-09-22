// Bootstrap de una BD DESECHABLE para el gate de regresión en vivo de CI (ENG-056 / EXEC operating model
// paso 7: integration/clinical-regression gates). Aplica roles + todas las migraciones en orden sobre
// DATABASE_URL, dejando el rol de arranque `medical_os_runtime` creado y grantable al usuario conector.
// Reutiliza la lógica ya probada de scripts/v22/restore-drill.mts. Idempotente-suficiente para un contenedor limpio.
//
// SEGURIDAD: aplica DDL y crea roles. Está pensado SOLO para un Postgres desechable (contenedor de CI o
// branch de Neon). REHÚSA correr si CI_DB_BOOTSTRAP_ALLOW no está en "1" (evita ejecutarlo contra una BD real).
import fs from"node:fs";
const URL_=process.env.DATABASE_URL;
if(!URL_){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
if(process.env.CI_DB_BOOTSTRAP_ALLOW!=="1"){console.log(JSON.stringify({status:"REFUSED",reason:"CI_DB_BOOTSTRAP_ALLOW!=1",hint:"solo contra un Postgres desechable"}));process.exit(2);}
const direct=(u:string)=>u.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const RUNTIME_ROLE="medical_os_runtime";
const{default:postgres}=await import("postgres");
const out:{status:string;steps:string[];note?:string}={status:"PASS",steps:[]};
const owner=postgres(direct(URL_),{max:1,prepare:false,onnotice:()=>{}});
try{
 // 1) Roles (idempotente). 2) Grant del rol runtime al usuario conector (para SET ROLE).
 await owner.unsafe(fs.readFileSync("db/roles_v16.sql","utf8"));out.steps.push("roles_v16");
 await owner.unsafe(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles g ON g.oid=m.member WHERE r.rolname='${RUNTIME_ROLE}' AND g.rolname=current_user) THEN EXECUTE 'GRANT ${RUNTIME_ROLE} TO '||quote_ident(current_user); END IF; END $$;`);out.steps.push("grant_runtime_role");
 // 3) Migraciones con el MISMO migrador que producción (auditoría P-06): tabla de control + checksums. En un contenedor
 //    limpio aplica 0001..N; si se re-ejecuta, aplica solo las pendientes y detecta deriva.
 const{spawnSync}=await import("node:child_process");
 const mig=spawnSync("pnpm",["-s","exec","tsx","scripts/db/migrate.mts","up"],{encoding:"utf8",env:process.env});
 if(mig.status!==0)throw new Error(`db:migrate up falló: ${(mig.stderr||mig.stdout).trim().slice(-400)}`);
 const files=fs.readdirSync("db/migrations").filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
 out.steps.push(`db:migrate up (${files.length} migraciones en el repo)`);
 // 4) Sanity: la tabla núcleo existe.
 const present=await owner`select to_regclass('public.clinical_events') as t`;
 if(!present[0]!.t)throw new Error("clinical_events ausente tras las migraciones");
 out.note=`aplicadas ${files.length} migraciones`;
}catch(e){out.status="FAIL";out.note=String(e);}
finally{await owner.end();}
console.log(JSON.stringify(out,null,2));
process.exit(out.status==="PASS"?0:1);
