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

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Auditoría 2026-09-19, anexo R06 (R06-F13, lote 23) — VERIFICACIÓN INDEPENDIENTE DE LA CADENA.
//
// EL HALLAZGO, y es preciso: la verificación de arriba recalcula la huella EN LA BASE con la misma expresión que la escribió.
// Eso detecta una fila alterada a mano, pero no es independiente: si la expresión tuviera un defecto, estaría en los dos lados
// y la verificación coincidiría con el error. El anexo lo puntuó nivel 4 justamente por esto.
//
// LO QUE SIGUE recalcula la huella FUERA de PostgreSQL, en Node, reproduciendo la serialización `jsonb::text`. Dos caminos
// distintos que llegan al mismo hash es lo que «independiente» significa. Las reglas de esa serialización, verificadas
// empíricamente contra el motor y no supuestas:
//   · las claves de un objeto se ordenan por LONGITUD y, a igual longitud, por bytes;
//   · el separador es `", "` y `": "` —con espacio—, no la forma compacta de `JSON.stringify`;
//   · `jsonb` guarda los números como `numeric` y CONSERVA su escala: un `1.50` escrito así se rinde `1.50`, no `1.5`.
//
// Ese último punto es el único que no se puede reproducir con certeza desde Node, porque la escala depende de cómo se escribió
// el número, no de su valor. En vez de fingir que coincide, una fila con un número que no sea entero seguro se marca
// NO VERIFICABLE INDEPENDIENTEMENTE y se declara en el veredicto. Un verificador que dijera «ok» sin poder recalcular sería el
// mismo teatro que el hallazgo describe, con una capa más.

/** Serializa un valor como lo hace `jsonb::text` de PostgreSQL. Lanza si encuentra un número que no puede reproducir. */
export function pgJsonbText(v:unknown):string{
 if(v===null)return "null";
 if(typeof v==="boolean")return v?"true":"false";
 if(typeof v==="number"){
  if(!Number.isFinite(v))throw new Error("PG_JSONB_NON_FINITE_NUMBER");
  // Un entero seguro se rinde igual en los dos lados. Cualquier otro caso —decimales, notación exponencial, magnitudes
  // grandes— depende de la escala con la que se escribió y NO se puede reproducir con certeza desde aquí.
  if(!Number.isSafeInteger(v))throw new Error("PG_JSONB_NUMBER_SCALE_UNKNOWN");
  return String(v);
 }
 if(typeof v==="string")return JSON.stringify(v);
 if(Array.isArray(v))return "["+v.map(pgJsonbText).join(", ")+"]";
 if(typeof v==="object"){
  const claves=Object.keys(v as Record<string,unknown>).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0));
  return "{"+claves.map(k=>`${JSON.stringify(k)}: ${pgJsonbText((v as Record<string,unknown>)[k])}`).join(", ")+"}";
 }
 throw new Error("PG_JSONB_UNSUPPORTED_TYPE");
}

/** Fila con el CONTENIDO necesario para recalcular la huella fuera de la base. */
export type AuditContentRow=Readonly<{
 sequence:number;id:string;tenantId:string;previousHash:string;actorId:string;action:string;resource:string;
 payload:unknown;entryHash:string;
}>;
export type IndependentVerdict=Readonly<{
 ok:boolean;checked:number;
 /** Filas cuya huella se recalculó en Node y COINCIDE con la almacenada. */
 independentlyConfirmed:number;
 /** Filas que Node no puede recalcular con certeza (números de escala desconocida). Se declaran, no se dan por buenas. */
 notIndependentlyVerifiable:readonly number[];
 mismatches:readonly number[];
}>;

/**
 * Recalcula la huella de cada fila EN NODE y la compara con la almacenada. El digest es
 * `sha256(jsonb_build_object(...)::text)` con las ocho claves en el mismo orden que `app.append_audit_v17`.
 */
export function verifyChainIndependently(rows:readonly AuditContentRow[],sha256:(s:string)=>string):IndependentVerdict{
 const noVerificables:number[]=[];const desajustes:number[]=[];let confirmadas=0;
 for(const r of rows){
  let texto:string;
  try{
   texto=pgJsonbText({tenant:r.tenantId,sequence:r.sequence,id:r.id,previousHash:r.previousHash,
    actor:r.actorId,action:r.action,resource:r.resource,payload:r.payload});
  }catch{noVerificables.push(r.sequence);continue;}
  if(sha256(texto)===r.entryHash)confirmadas++;else desajustes.push(r.sequence);
 }
 return{ok:desajustes.length===0,checked:rows.length,independentlyConfirmed:confirmadas,
  notIndependentlyVerifiable:noVerificables,mismatches:desajustes};
}

/**
 * ANCLA de la cadena: la última huella conocida, guardada FUERA de la base de datos.
 *
 * Es el control que la recomputación no puede dar por sí sola. Alguien con acceso de propietario podría reescribir la cadena
 * completa —recalculando todas las huellas— y cualquier verificación interna la encontraría íntegra. Comparar contra un ancla
 * guardada en el repositorio detecta exactamente eso: la cadena de hoy tiene que CONTENER la huella de ayer en su secuencia.
 */
export type AuditAnchor=Readonly<{tenantId:string;sequence:number;entryHash:string;anchoredAt:string}>;
export type AnchorVerdict=Readonly<{ok:boolean;reason?:"ANCHOR_SEQUENCE_MISSING"|"ANCHOR_HASH_MISMATCH"|"CHAIN_SHORTER_THAN_ANCHOR"}>;
export function verifyAgainstAnchor(rows:readonly{sequence:number;entryHash:string}[],anchor:AuditAnchor):AnchorVerdict{
 const fila=rows.find(r=>r.sequence===anchor.sequence);
 if(!fila){
  // Distinguir «la cadena se acortó» de «falta esa secuencia» importa: lo primero es una truncación, lo segundo un hueco.
  const max=rows.reduce((a,r)=>Math.max(a,r.sequence),0);
  return{ok:false,reason:max<anchor.sequence?"CHAIN_SHORTER_THAN_ANCHOR":"ANCHOR_SEQUENCE_MISSING"};
 }
 return fila.entryHash===anchor.entryHash?{ok:true}:{ok:false,reason:"ANCHOR_HASH_MISMATCH"};
}
