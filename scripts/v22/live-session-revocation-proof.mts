// Auditoría 2026-09-19, anexo R01 (R01-014) — EVIDENCIA FÍSICA de la revocación de sesión contra Postgres real.
// Antes, `DELETE /api/v1/sessions` solo borraba la cookie: el token seguía abriendo la API hasta cumplir su TTL de 15
// minutos y no existía forma de cortar una sesión comprometida. Esta prueba demuestra, contra la base, que:
//   1) una sesión recién emitida lee y escribe;
//   2) tras el logout la MISMA sesión ya no lee (401 SESSION_REVOKED) ni escribe, aunque su token siga vigente;
//   3) la revocación es por sesión, no por actor: otra sesión del mismo usuario sigue trabajando;
//   4) revocar dos veces no es un error (idempotente) y la fila queda aislada por tenant (RLS);
//   5) la lista de denegación no permite borrar filas al rol de la aplicación (append-only para la app).
// Ejecuta: pnpm exec tsx ./scripts/v22/live-session-revocation-proof.mts
import crypto from"node:crypto";
import{libro}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
import{directEndpoint}from"../../packages/pg-endpoint/src";
const{freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir en el tenant
process.env.AUTH_MODE="development";
process.env.ALLOW_DEV_IDENTITY="true";
delete process.env.VERCEL_ENV;
const IDP_SECRET=process.env.DEV_IDENTITY_SECRET="r01-014-dev-idp-secret";

const{signSession}=await import("../../packages/session/src");
const postgres=(await import("postgres")).default;
const sessions=await import("../../apps/web/app/api/v1/sessions/route");
const encounters=await import("../../apps/web/app/api/v1/encounters/route");
const timeline=await import("../../apps/web/app/api/v1/patients/[patientId]/timeline/route");

const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const now=Math.floor(Date.now()/1000);
const TENANT=crypto.randomUUID(),SUB=crypto.randomUUID();
const{result,ok,fin}=libro();
const assertion=():string=>signSession({sub:SUB,tenantId:TENANT,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read","patient:write","patient:read"],purpose:"TREATMENT",iat:now-5,exp:now+900,sessionId:crypto.randomUUID()},IDP_SECRET);
const login=async():Promise<{token:string;sessionId:string}>=>{
 const r=await sessions.POST(new Request("http://l/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json","x-medos-token-delivery":"body"},body:JSON.stringify({assertion:assertion()})}));
 const b=await r.json() as{token:string;sessionId:string};
 if(r.status!==201||typeof b.token!=="string")throw new Error("FAIL:LOGIN_PRECONDITION");
 return b;
};
const abrirEncuentro=(token:string,patientId:string):Promise<Response>=>encounters.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token,"idempotency-key":crypto.randomUUID()},body:JSON.stringify({encounterId:crypto.randomUUID(),patientId,occurredAt:new Date().toISOString()})}));
const leerTimeline=(token:string,patientId:string):Promise<Response>=>timeline.GET(new Request("http://l/",{headers:{authorization:"Bearer "+token}}),{params:Promise.resolve({patientId})});
const logout=(token:string):Promise<Response>=>sessions.DELETE(new Request("http://l/api/v1/sessions",{method:"DELETE",headers:{authorization:"Bearer "+token}}));

try{
 const patientId=await freshPatient(TENANT);

 // 1) Sesión viva: lee y escribe.
 const a=await login();
 ok((await abrirEncuentro(a.token,patientId)).status===201,"SESION_VIVA_ESCRIBE");
 ok((await leerTimeline(a.token,patientId)).status===200,"SESION_VIVA_LEE");

 // 2) Segunda sesión del MISMO usuario (para demostrar que la revocación es por sesión).
 const b=await login();
 ok(b.sessionId!==a.sessionId,"DOS_SESIONES_DISTINTAS");

 // 3) Logout de la primera: revoca de verdad.
 const out=await logout(a.token);
 const outBody=await out.json() as{ok:boolean;revoked:boolean};
 ok(out.status===200&&outBody.revoked===true,"LOGOUT_REVOCA");
 const filas=await sql`select session_id,tenant_id,reason from session_revocations where session_id=${a.sessionId}`;
 ok(filas.length===1&&String(filas[0]?.["tenant_id"])===TENANT&&String(filas[0]?.["reason"])==="LOGOUT","REVOCACION_PERSISTIDA_CON_TENANT");

 // 4) El token revocado ya NO lee ni escribe, aunque siga dentro de su TTL.
 const rLectura=await leerTimeline(a.token,patientId);
 const cuerpoLectura=await rLectura.json() as{error?:{code?:string;details?:{reason?:string}}};
 ok(rLectura.status===401&&cuerpoLectura.error?.code==="UNAUTHENTICATED","TOKEN_REVOCADO_NO_LEE");
 ok(cuerpoLectura.error?.details?.reason==="SESSION_REVOKED","MOTIVO_EXPLICITO_AL_CLIENTE");
 const rEscritura=await abrirEncuentro(a.token,patientId);
 ok(rEscritura.status===401,"TOKEN_REVOCADO_NO_ESCRIBE");
 // ...y no dejó rastro de escritura: el comando no se ejecutó (preflight dentro de la transacción).
 const eventos=await sql`select count(*)::int as n from clinical_events where tenant_id=${TENANT} and aggregate_type='Encounter'`;
 ok(Number(eventos[0]?.["n"])===1,"NINGUNA_ESCRITURA_TRAS_REVOCAR");

 // 5) La otra sesión del mismo usuario sigue trabajando: se revocó la sesión, no la persona.
 ok((await leerTimeline(b.token,patientId)).status===200,"OTRA_SESION_SIGUE_VIVA");
 ok((await abrirEncuentro(b.token,patientId)).status===201,"OTRA_SESION_SIGUE_ESCRIBIENDO");

 // 6) Revocar dos veces no es un error (idempotente) y no duplica la fila.
 const out2=await logout(a.token);
 ok(out2.status===200,"LOGOUT_IDEMPOTENTE");
 const filas2=await sql`select count(*)::int as n from session_revocations where session_id=${a.sessionId}`;
 ok(Number(filas2[0]?.["n"])===1,"SIN_FILA_DUPLICADA");

 // 7) Logout sin sesión válida: limpia la cookie y dice la verdad (no promete haber revocado nada).
 const out3=await logout("token.invalido");
 const body3=await out3.json() as{revoked:boolean};
 ok(out3.status===200&&body3.revoked===false,"LOGOUT_SIN_SESION_NO_MIENTE");

 // 8) El rol de la aplicación no puede BORRAR de la lista de denegación (una revocación no se deshace en silencio).
 const rol=await sql`select has_table_privilege('medical_os_runtime','session_revocations','DELETE') as puede`;
 ok(rol[0]?.["puede"]===false,"APP_SIN_DELETE_EN_LA_LISTA");

 // 9) Aislamiento entre tenants: la fila no es visible con el contexto de otro tenant (RLS forzada).
 const otro=crypto.randomUUID();
 const visibles=await sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${otro},true)`;
  await tx`set local role medical_os_runtime`;
  return tx`select count(*)::int as n from session_revocations where session_id=${a.sessionId}`;
 }) as unknown as {n:number}[];
 ok(Number(visibles[0]?.n)===0,"RLS_AISLA_LA_REVOCACION");
}catch(e){result.status="FAIL";result.error=e instanceof Error?e.message:String(e);}
finally{await sql.end({timeout:5});}
fin();
