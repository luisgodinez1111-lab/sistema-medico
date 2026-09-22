import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{verifyChain,RECOMPUTE_DIGEST_SQL,AUDIT_GENESIS,type AuditChainRow}from"../../packages/audit-verifier/src";
// Auditoría 2026-09-19 (S-07) — el verificador usaba otra fórmula que la base: nunca podía verificar la cadena real.
const row=(sequence:number,previousHash:string,entryHash:string,recomputedHash=entryHash):AuditChainRow=>({sequence,previousHash,entryHash,recomputedHash});
describe("verifyChain — enlace de la cadena (puro)",()=>{
 it("cadena válida: secuencia contigua desde 1, génesis GENESIS, cada previous_hash = entry_hash anterior, huella recalculada = guardada",()=>{
  const v=verifyChain([row(1,AUDIT_GENESIS,"h1"),row(2,"h1","h2"),row(3,"h2","h3")]);
  expect(v).toEqual({ok:true,checked:3,lastHash:"h3"});
  expect(verifyChain([])).toEqual({ok:true,checked:0,lastHash:AUDIT_GENESIS});
 });
 it("una fila alterada: la huella recalculada en la base ya no coincide con la guardada",()=>{
  expect(verifyChain([row(1,AUDIT_GENESIS,"h1"),row(2,"h1","h2","OTRA")])).toEqual({ok:false,checked:1,brokenAtSequence:2,reason:"HASH_MISMATCH"});
 });
 it("una fila borrada en medio: hueco de secuencia",()=>{
  expect(verifyChain([row(1,AUDIT_GENESIS,"h1"),row(3,"h2","h3")])).toMatchObject({ok:false,brokenAtSequence:3,reason:"SEQUENCE_GAP"});
 });
 it("un enlace roto (previous_hash que no apunta a la anterior) o una génesis falsa",()=>{
  expect(verifyChain([row(1,AUDIT_GENESIS,"h1"),row(2,"hX","h2")])).toMatchObject({ok:false,brokenAtSequence:2,reason:"LINK_MISMATCH"});
  expect(verifyChain([row(1,"no-genesis","h1")])).toMatchObject({ok:false,brokenAtSequence:1,reason:"LINK_MISMATCH"});
 });
});
describe("la expresión de recálculo es la MISMA que escribe la base (db/migrations/0013)",()=>{
 it("jsonb_build_object con las mismas claves, en el mismo orden, y el mismo digest",()=>{
  const sql=fs.readFileSync("db/migrations/0013_transactional_authority_and_audit.sql","utf8");
  const m=/digest:=encode\(digest\(convert_to\(jsonb_build_object\((.*?)\)::text,'UTF8'\),'sha256'\),'hex'\);/.exec(sql);
  expect(m).not.toBeNull();
  // En la función SQL los valores son parámetros (p_tenant, h.last_hash…); en el recálculo son las columnas de la fila.
  const fromDb=m![1]!.replace(/p_tenant/g,"tenant_id").replace(/\bseq\b/g,"sequence").replace(/p_id/g,"id").replace(/h\.last_hash/g,"previous_hash").replace(/p_actor/g,"actor_id").replace(/p_action/g,"action").replace(/p_resource/g,"resource").replace(/p_payload/g,"payload");
  expect(RECOMPUTE_DIGEST_SQL).toBe(`encode(digest(convert_to(jsonb_build_object(${fromDb})::text,'UTF8'),'sha256'),'hex')`);
 });
});
