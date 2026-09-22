import type{Sql}from"postgres";
// Auditoría 2026-09-19 (S-07) — VERIFICADOR REAL de la cadena de auditoría.
//
// Antes este paquete calculaba sha256(`${prevHash}:${payload}`), una fórmula que NO es la que escribe la base de datos
// (`app.append_audit_v17`, migración 0013): jamás habría podido verificar la cadena real. Reproducir en Node la serialización
// `jsonb::text` de PostgreSQL (orden de claves por longitud y bytes, espaciado, normalización de números) es frágil, así que
// la huella se RECALCULA EN LA BASE con la misma expresión de la función que la escribió: misma máquina, mismo resultado.
// El enlace de la cadena (secuencia contigua desde 1, `previous_hash` = `entry_hash` anterior, génesis 'GENESIS') se
// comprueba aquí, en una función pura y testeable.
export const AUDIT_GENESIS="GENESIS";
export type AuditChainRow=Readonly<{sequence:number;previousHash:string;entryHash:string;recomputedHash:string}>;
export type AuditChainVerdict=Readonly<{ok:true;checked:number;lastHash:string}|{ok:false;checked:number;brokenAtSequence:number;reason:"SEQUENCE_GAP"|"LINK_MISMATCH"|"HASH_MISMATCH"}>;
export function verifyChain(rows:readonly AuditChainRow[]):AuditChainVerdict{
 let prev=AUDIT_GENESIS,expectedSeq=1,checked=0;
 for(const r of rows){
  if(r.sequence!==expectedSeq)return{ok:false,checked,brokenAtSequence:r.sequence,reason:"SEQUENCE_GAP"};
  if(r.previousHash!==prev)return{ok:false,checked,brokenAtSequence:r.sequence,reason:"LINK_MISMATCH"};
  if(r.recomputedHash!==r.entryHash)return{ok:false,checked,brokenAtSequence:r.sequence,reason:"HASH_MISMATCH"};
  prev=r.entryHash;expectedSeq++;checked++;
 }
 return{ok:true,checked,lastHash:prev};
}
// La expresión es, carácter a carácter, la de `app.append_audit_v17` (db/migrations/0013): si alguien cambia la función SQL sin
// cambiar esto, la verificación falla en la primera fila (fail-closed), que es exactamente lo deseable.
export const RECOMPUTE_DIGEST_SQL="encode(digest(convert_to(jsonb_build_object('tenant',tenant_id,'sequence',sequence,'id',id,'previousHash',previous_hash,'actor',actor_id,'action',action,'resource',resource,'payload',payload)::text,'UTF8'),'sha256'),'hex')";
export type TenantAuditContext=Readonly<{tenantId:string;actorId:string;purpose:string;requestId:string}>;
// Verifica la cadena completa de UN tenant bajo su contexto RLS. Solo lectura.
export async function verifyTenantAuditChain(sql:Sql,ctx:TenantAuditContext):Promise<AuditChainVerdict&{tenantId:string}>{
 const rows=await sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
  return tx.unsafe(`select sequence::int as sequence, previous_hash, entry_hash, ${RECOMPUTE_DIGEST_SQL} as recomputed from audit_chain_v3 where tenant_id=$1 order by sequence`,[ctx.tenantId]);
 }) as unknown as ReadonlyArray<Record<string,unknown>>;
 const verdict=verifyChain(rows.map(r=>({sequence:Number(r["sequence"]),previousHash:String(r["previous_hash"]??""),entryHash:String(r["entry_hash"]??""),recomputedHash:String(r["recomputed"]??"")})));
 return{...verdict,tenantId:ctx.tenantId};
}
