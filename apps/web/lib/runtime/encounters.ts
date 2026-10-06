// Read-models de la CONSULTA como unidad clínica: qué consultas tuvo un paciente y qué dice la nota de cada una.
//
// Auditoría R01-001 / guardián de god-module: salió de `records.ts` cuando ese fichero pasó de 300 líneas al añadir el
// lector de la nota. El guardián tenía razón, como en `lab-facts` y `read-model-joins`: `records.ts` lee el EXPEDIENTE
// (línea de tiempo, documentos, obligaciones que bloquean la firma) y esto lee LA CONSULTA — qué se valoró, qué se planeó,
// quién lo firmó. Son dos preguntas distintas con dos lectores distintos.
//
// Auditoría clínica multiespecialidad (06-oct-2026): hasta esta fecha la valoración y el plan que el médico firmaba no se
// podían volver a leer por ninguna ruta de la aplicación. Ese es el hallazgo que crea este módulo.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{logPhiAccess}from"../phi-access-log";
import{withTenantTx}from"./connection";

export type EncounterView=Readonly<{encounterId:string;version:number;events:ReadonlyArray<{sequence:number;type:string;occurredAt:string}>}>;
// Lectura RLS-scoped del agregado (sin payload clínico: solo metadatos no-PHI).
export async function readEncounter(ctx:HttpTenantContext,encounterId:string):Promise<EncounterView|null>{
 return withTenantTx(ctx,async tx=>{
  const agg=await tx`select version from aggregate_versions where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId}`;
  const head=agg[0];
  if(!head)return null;
  const events=await tx`select sequence,aggregate_type,occurred_at from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return{
   encounterId,
   version:Number(head.version),
   events:events.map(e=>({sequence:Number(e.sequence),type:String(e.aggregate_type),occurredAt:String(e.occurred_at)})),
  };
 });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Auditoría clínica multiespecialidad (06-oct-2026) — LA NOTA FIRMADA ERA DE SOLO ESCRITURA.
//
// EL HALLAZGO, que cuatro especialistas pusieron en primer lugar POR SEPARADO —medicina interna, urgencias, medicina
// familiar y oncología—: el texto de una consulta se escribe en el evento `ENCOUNTER_ASSESSED`, se firma por hash, y NINGUNA
// ruta lo devuelve. `readEncounter` (arriba) descarta el payload a propósito —«solo metadatos no-PHI»— y el timeline lo
// declara. El médico familiar lo resumió así: «volteo la hoja de papel y leo lo que escribí hace tres meses en dos
// segundos; aquí ese acto no tiene ruta».
//
// Consecuencias que se midieron, no que se supusieron: un hipertenso de diez años se sienta y el médico no sabe qué le
// indicó; el oncólogo no puede reconstruir tres años; y en México previsiblemente incumple la NOM-004, que exige que el
// expediente sea consultable.
//
// LO QUE ESTAS DOS FUNCIONES HACEN, y la diferencia importa:
//   · `listPatientEncounters` — las consultas del paciente CON SUS FECHAS, para poder elegir una. No trae el texto.
//   · `readEncounterNote` — el contenido de UNA consulta. Trae PHI, así que registra el acceso en `phi_access_log`: quién
//     leyó la nota de quién, cuándo y con qué propósito. Leer un expediente es un acto auditable, no una consulta más.
export type EncounterListItem=Readonly<{
 encounterId:string;status:string;version:number;
 /** Cuándo se abrió la consulta y cuándo fue su último evento: es lo que permite ordenarlas y reconocerlas. */
 openedAt:string;lastAt:string;
 /** Si está firmada, cuándo. `null` mientras siga abierta: un borrador no es una consulta. */
 signedAt:string|null;
 /** ¿Tiene nota escrita? Permite distinguir una consulta vacía de una documentada sin traer el texto. */
 hasNote:boolean;
}>;
/** Consultas de un paciente, de la más reciente a la más antigua. Sin contenido clínico: es un índice para elegir. */
export async function listPatientEncounters(ctx:HttpTenantContext,patientId:string,opts:{limit?:number}={}):Promise<EncounterListItem[]>{
 const limit=Math.max(1,Math.min(opts.limit??50,200));
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select e.aggregate_id,
     min(e.occurred_at) as opened_at,
     max(e.occurred_at) as last_at,
     max(e.sequence) as version,
     max(case when e.payload->>'kind'='SIGNED' then e.occurred_at end) as signed_at,
     bool_or(e.payload->>'kind'='ASSESSED' and coalesce(e.payload->>'assessment','')<>'') as has_note,
     (array_agg(e.payload->>'kind' order by e.sequence desc))[1] as latest_kind
   from clinical_events e
   where e.tenant_id=${ctx.tenantId} and e.aggregate_type='Encounter'
     and e.aggregate_id in (
      select aggregate_id from clinical_events
      where tenant_id=${ctx.tenantId} and aggregate_type='Encounter' and sequence=1 and payload->>'patientId'=${patientId})
   group by e.aggregate_id
   order by min(e.occurred_at) desc
   limit ${limit}`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   encounterId:String(o.aggregate_id),
   status:String(o.latest_kind??"OPENED"),
   version:Number(o.version??0),
   openedAt:new Date(String(o.opened_at)).toISOString(),
   lastAt:new Date(String(o.last_at)).toISOString(),
   signedAt:o.signed_at?new Date(String(o.signed_at)).toISOString():null,
   hasNote:o.has_note===true,
  };});
 });
}

export type EncounterNote=Readonly<{
 encounterId:string;patientId:string;status:string;version:number;openedAt:string;
 /** El texto que el médico escribió y firmó. `null` si la consulta no llegó a documentarse. */
 assessment:string|null;plan:string|null;
 /** Firma: cuándo, con qué huella de contenido y quién la produjo (nombre y cédula del firmante). */
 signedAt:string|null;signatureDigest:string|null;contentHash:string|null;
 /** Identidad legal del firmante, con las MISMAS claves que el sello (`fullName`/`cedulaProfesional`): renombrarlas aquí
  * habría obligado a mantener dos vocabularios para el mismo dato. */
 signer:{fullName?:string;cedulaProfesional?:string;institution?:string;specialty?:string}|null;
 /** Enmiendas posteriores a la firma: una nota firmada no se edita, se enmienda, y la enmienda se lee aparte. */
 amendments:ReadonlyArray<{at:string;text:string;reason:string}>;
}>;
/**
 * Contenido de UNA consulta. Registra el acceso en `phi_access_log` porque devuelve PHI; sin ese registro no se podría
 * responder a un derecho de acceso ni investigar quién leyó un expediente.
 */
export async function readEncounterNote(ctx:HttpTenantContext,encounterId:string):Promise<EncounterNote|null>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select sequence,payload,occurred_at from clinical_events
   where tenant_id=${ctx.tenantId} and aggregate_type='Encounter' and aggregate_id=${encounterId} order by sequence`;
  if(rows.length===0)return null;
  let patientId="",assessment:string|null=null,plan:string|null=null,status="OPENED";
  let signedAt:string|null=null,signatureDigest:string|null=null,contentHash:string|null=null;
  let signer:EncounterNote["signer"]=null;
  const amendments:{at:string;text:string;reason:string}[]=[];
  const openedAt=new Date(String((rows[0] as Record<string,unknown>).occurred_at)).toISOString();
  for(const row of rows){
   const r=row as Record<string,unknown>;
   const p=(r.payload??{}) as Record<string,unknown>;
   const kind=String(p["kind"]??"");
   if(kind)status=kind;
   if(kind==="OPENED")patientId=String(p["patientId"]??patientId);
   if(kind==="ASSESSED"){
    // La última valoración gana: mientras no esté firmada, el médico puede corregirla (L-03) y lo que se lee es la vigente.
    if(typeof p["assessment"]==="string")assessment=p["assessment"] as string;
    if(typeof p["plan"]==="string")plan=p["plan"] as string;
   }
   if(kind==="SIGNED"){
    signedAt=new Date(String(r.occurred_at)).toISOString();
    signatureDigest=typeof p["signatureDigest"]==="string"?p["signatureDigest"] as string:null;
    contentHash=typeof p["contentHash"]==="string"?p["contentHash"] as string:null;
    // Se copian las claves que el sello guarda, no un renombrado: el firmante que se lee tiene que ser el que se firmó.
    const s=p["signer"];
    if(s&&typeof s==="object"){
     const c=s as Record<string,unknown>;const txt=(k:string)=>typeof c[k]==="string"?String(c[k]):undefined;
     const sg:Record<string,string>={};
     for(const k of["fullName","cedulaProfesional","institution","specialty"]){const v=txt(k);if(v)sg[k]=v;}
     signer=Object.keys(sg).length?sg as EncounterNote["signer"]:null;
    }
   }
   if(kind==="AMENDED")amendments.push({at:new Date(String(r.occurred_at)).toISOString(),
    text:String(p["amendment"]??p["text"]??""),reason:String(p["reason"]??"")});
  }
  // El acceso se registra DENTRO de la misma transacción: si la lectura ocurre, el registro ocurre.
  await logPhiAccess(tx,ctx,{resourceType:"ENCOUNTER_NOTE",resourceId:encounterId,...(patientId?{patientId}:{})});
  const version=Number((rows[rows.length-1] as Record<string,unknown>).sequence??0);
  return{encounterId,patientId,status,version,openedAt,assessment,plan,signedAt,signatureDigest,contentHash,signer,amendments};
 });
}
