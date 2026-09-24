import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{assertSessionNotRevoked,revokeSession,SESSION_REVOKED}from"../../apps/web/lib/session-revocation";
import{databaseIsLocal}from"../../apps/web/lib/session-issuance";
// Auditoría 2026-09-19, anexo R01 — R01-013 (token de sesión en el cuerpo de la respuesta de login), R01-014 (el logout no
// revocaba: un token exfiltrado seguía válido hasta el TTL) y R01-010 (una sola señal apagaba el verificador de identidad
// de desarrollo). La prueba de integración con Postgres real está en scripts/v22/live-session-revocation-proof.mts.
type Row=Record<string,unknown>;
// Doble de la transacción: devuelve las filas que se le programen y registra las consultas.
const fakeTx=(rows:Row[][]):{tx:never;consultas:string[]}=>{
 const consultas:string[]=[];let i=0;
 const tx=((strings:TemplateStringsArray,...values:unknown[])=>{
  consultas.push(strings.join("?")+" :: "+JSON.stringify(values));
  return Promise.resolve(rows[i++]??[]);
 }) as unknown as never;
 return{tx,consultas};
};

describe("revocación de sesión (R01-014)",()=>{
 it("una sesión presente en la lista de denegación se rechaza como no autenticada",async()=>{
  const{tx}=fakeTx([[{"1":1}]]);
  await expect(assertSessionNotRevoked(tx,"11111111-1111-4111-8111-111111111111")).rejects.toMatchObject({code:"UNAUTHENTICATED"});
 });
 it("el error nombra el motivo para que el cliente sepa que debe volver a iniciar sesión, sin filtrar PHI",async()=>{
  const{tx}=fakeTx([[{"1":1}]]);
  const err=await assertSessionNotRevoked(tx,"11111111-1111-4111-8111-111111111111").catch((e:unknown)=>e) as{details?:Record<string,unknown>;message:string};
  expect(err.details?.["reason"]).toBe(SESSION_REVOKED);
  expect(JSON.stringify(err)).not.toMatch(/paciente|birthDate|curp/i);
 });
 it("una sesión ausente de la lista pasa",async()=>{
  const{tx}=fakeTx([[]]);
  await expect(assertSessionNotRevoked(tx,"11111111-1111-4111-8111-111111111111")).resolves.toBeUndefined();
 });
 it("un contexto sin sesión (script de operación, recuperación) no consulta la lista",async()=>{
  const{tx,consultas}=fakeTx([]);
  await assertSessionNotRevoked(tx,undefined);
  expect(consultas).toEqual([]);
 });
 it("revocar es idempotente y devuelve si ya estaba revocada",async()=>{
  const{tx,consultas}=fakeTx([[{existed:true}]]);
  const yaEstaba=await revokeSession(tx,{sessionId:"11111111-1111-4111-8111-111111111111",tenantId:"22222222-2222-4222-8222-222222222222",actorId:"33333333-3333-4333-8333-333333333333",reason:"LOGOUT",expiresAt:new Date("2026-09-23T12:00:00Z")});
  expect(yaEstaba).toBe(true);
  expect(consultas[0]).toContain("revoke_session");
 });
});

describe("la comprobación está cableada en las dos puertas (R01-014)",()=>{
 const runtime=fs.readFileSync("apps/web/lib/clinical-runtime.ts","utf8");
 it("toda lectura con contexto de sesión la comprueba (withTenantTx)",()=>{
  expect(/async function withTenantTx<T>[\s\S]*?assertSessionNotRevoked\(tx,ctx\.sessionId\)/.test(runtime)).toBe(true);
 });
 it("toda escritura la comprueba DENTRO de la transacción del comando (preflight del kernel)",()=>{
  expect(runtime).toContain("executeAtomicClinicalCommand(getSql(),ctx,command,tx=>assertSessionNotRevoked(tx,ctx.sessionId))");
  const kernel=fs.readFileSync("packages/atomic-clinical-transaction-v3/src/index.ts","utf8");
  // el hook corre tras fijar el contexto y ANTES de tocar idempotencia/agregados
  const orden=[kernel.indexOf("set_config('app.tenant_id'"),kernel.indexOf("if(preflight)await preflight(tx)"),kernel.indexOf("command_idempotency")];
  expect(orden[0]).toBeGreaterThan(-1);expect(orden[1]).toBeGreaterThan(orden[0]!);expect(orden[2]).toBeGreaterThan(orden[1]!);
 });
 it("el logout revoca y responde sin prometer lo que no hizo",()=>{
  const issuance=fs.readFileSync("apps/web/lib/session-issuance.ts","utf8");
  expect(issuance).toContain("revokeCurrentSession");
  expect(issuance).toMatch(/revoked:true/);
  expect(issuance).toMatch(/revoked:false/); // sin sesión válida: no había nada que revocar
 });
 it("la migración 0023 aísla la tabla por tenant y no concede borrado a la app",()=>{
  const sql=fs.readFileSync("db/migrations/0023_session_revocations.sql","utf8");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toMatch(/GRANT SELECT, INSERT ON session_revocations TO medical_os_runtime/);
  expect(sql).not.toMatch(/GRANT[^;]*DELETE[^;]*TO medical_os_runtime/);
 });
});

describe("el token de sesión no viaja en el cuerpo por defecto (R01-013)",()=>{
 const issuance=fs.readFileSync("apps/web/lib/session-issuance.ts","utf8");
 it("sin la cabecera explícita, la respuesta de login no incluye el token",()=>{
  expect(issuance).toContain('x-medos-token-delivery');
  expect(issuance).toMatch(/tokenType:"Cookie"/);
 });
 it("un cliente de API lo pide explícitamente y queda registrado",()=>{
  expect(issuance).toMatch(/wantsBearer[\s\S]*token:session\.token/);
  expect(issuance).toContain("session.token_delivered_in_body");
 });
});

describe("verificador de identidad de desarrollo: segunda señal independiente (R01-010)",()=>{
 const conDatabaseUrl=(url:string|undefined,run:()=>void):void=>{
  const prev=process.env.DATABASE_URL;
  if(url===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=url;
  try{run();}finally{if(prev===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prev;}
 };
 it("reconoce como local únicamente los hosts de desarrollo",()=>{
  conDatabaseUrl("postgres://postgres@127.0.0.1:5432/medical_os",()=>expect(databaseIsLocal()).toBe(true));
  conDatabaseUrl("postgres://postgres@localhost:5432/medical_os",()=>expect(databaseIsLocal()).toBe(true));
  conDatabaseUrl("postgres://u:p@ep-cool-name.us-east-2.aws.neon.tech/medical_os?sslmode=require",()=>expect(databaseIsLocal()).toBe(false));
 });
 it("sin DATABASE_URL no bloquea por esta señal (el login fallará después por dependencia)",()=>{
  conDatabaseUrl(undefined,()=>expect(databaseIsLocal()).toBe(true));
 });
});
