import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{isUuid}from"../../../packages/tenant-context/src";
import type{ClinicalCommand}from"../../../packages/atomic-clinical-transaction-v3/src";
// Auditoría 2026-09-19, anexo R06 (R06-19) — ESQUEMA DEL PAYLOAD por (aggregateType, kind) antes de persistir.
//
// El kernel garantiza lo estructural (objeto JSON, `kind` presente, serializable, acotado). Aquí vive lo que el kernel no
// puede saber: qué campos exige CADA evento clínico. Sin esto, el evento se escribía en una tabla append-only con la forma
// que trajera, y el fold lo descubría al leerlo —mucho después, y ya sin poder corregirlo, porque la cadena es inmutable—.
//
// Criterio de cobertura: se declaran los eventos FUNDACIONALES (el primero de cada agregado, el que crea el estado y del
// que dependen todos los folds) y las anotaciones cuya ausencia de un campo rompe una decisión clínica. Las transiciones
// puras (`kind` + `occurredAt`) no necesitan esquema propio: el kernel ya exige el discriminador y la máquina de estados
// valida la transición. `uuid` y `noVacio` se repiten a propósito: un `patientId` vacío es el defecto que hay que atrapar.
// Formato de UUID, NO la variante RFC: la columna `uuid` de Postgres acepta cualquier 32 hex (incluido el todo-ceros de
// los datos sembrados), así que rechazar aquí lo que la base sí guarda rompería flujos legítimos. Lo que hay que atrapar es
// un identificador que NO es un UUID en absoluto («paciente-1»), que es el defecto que el anexo describe.
const uuid=z.string().trim().refine(isUuid,"debe ser un UUID");
const noVacio=z.string().trim().min(1);
const base=(kind:string)=>z.object({kind:z.literal(kind)});
/** Esquemas por `aggregateType::kind`. `passthrough` a propósito: se validan los campos EXIGIDOS, no se prohíben extras. */
export const PAYLOAD_SCHEMAS:Readonly<Record<string,z.ZodType>>={
 // — Paciente y su identidad —
 "Patient::REGISTERED":base("REGISTERED").extend({patientId:uuid.optional(),name:noVacio,birthDate:noVacio,sexAtBirth:noVacio}).passthrough(),
 // — Datos clínicos que alimentan cálculos y barreras —
 "VitalSign::RECORDED":base("RECORDED").extend({patientId:uuid,vitalType:noVacio,value:noVacio,unit:noVacio,canonicalValue:noVacio,canonicalUnit:noVacio}).passthrough(),
 "VitalSign::AMENDED":base("AMENDED").extend({value:noVacio,unit:noVacio,canonicalValue:noVacio,canonicalUnit:noVacio,reason:noVacio}).passthrough(),
 "VitalSign::ENTERED_IN_ERROR":base("ENTERED_IN_ERROR").extend({reason:noVacio}).passthrough(),
 "DiagnosticResult::RECEIVED":base("RECEIVED").extend({patientId:uuid,orderId:uuid,analyte:noVacio,value:noVacio}).passthrough(),
 "DiagnosticResult::ENTERED_IN_ERROR":base("ENTERED_IN_ERROR").extend({reason:z.string().trim().min(10)}).passthrough(),
 "DiagnosticResult::CORRECTED":base("CORRECTED").extend({supersededBy:uuid,reason:noVacio}).passthrough(),
 "ClinicalProblem::ADDED":base("ADDED").extend({patientId:uuid,code:noVacio,codeSystem:noVacio}).passthrough(),
 "Allergy::RECORDED":base("RECORDED").extend({patientId:uuid,substance:noVacio}).passthrough(),
 "Medication::PROPOSED":base("PROPOSED").extend({patientId:uuid,drugCode:noVacio,dose:noVacio,route:noVacio,frequency:noVacio}).passthrough(),
 "Immunization::DUE":base("DUE").extend({patientId:uuid,vaccineCode:noVacio}).passthrough(),
 // Matriz fundacional de antecedentes (historia clínica basal). El guard fundamental: existe paciente y la matriz es un
 // objeto; su forma estructurada la valida el handler (antecedentes-lifecycle). La enmienda exige motivo.
 "Antecedentes::RECORDED":base("RECORDED").extend({patientId:uuid,content:z.object({}).passthrough()}).passthrough(),
 "Antecedentes::AMENDED":base("AMENDED").extend({content:z.object({}).passthrough(),reason:noVacio}).passthrough(),
 // — Piezas médico-legales: lo que autoriza y lo que firma —
 "Consent::DRAFTED":base("DRAFTED").extend({patientId:uuid,scopeType:noVacio,documentRef:noVacio}).passthrough(),
 // La huella del documento es OPCIONAL al PRESENTAR (el lote 11a la exige al OTORGAR, y ahí se compara con la presentada):
 // el esquema valida su FORMA cuando viene, no su presencia. Un esquema más estricto que el dominio rompe un flujo legítimo.
 "Consent::PRESENTED":base("PRESENTED").extend({documentHash:z.string().regex(/^[0-9a-f]{64}$/).optional()}).passthrough(),
 "ClinicalObligation::CREATED":base("CREATED").extend({patientId:uuid,ownerId:uuid,dueAt:noVacio,obligationKind:noVacio}).passthrough(),
 "Encounter::OPENED":base("OPENED").extend({patientId:uuid}).passthrough(),
 // — Citas: la ventana de la agenda se compara como timestamptz, así que el instante tiene que ser un instante —
 "Appointment::SCHEDULED":base("SCHEDULED").extend({patientId:uuid,startAt:z.string().datetime()}).passthrough(),
};
export const payloadSchemaKey=(aggregateType:string,kind:string):string=>`${aggregateType}::${kind}`;
/** Cuántos pares (aggregateType, kind) tienen esquema declarado (para el guardián de cobertura). */
export const payloadSchemaCount=():number=>Object.keys(PAYLOAD_SCHEMAS).length;
/**
 * Valida el payload contra el esquema de su par (aggregateType, kind) si existe. Un par SIN esquema no se rechaza —el
 * kernel ya exigió lo estructural— pero un par CON esquema que no encaja no se escribe: el registro clínico es inmutable.
 */
export function assertPayloadSchema(c:Pick<ClinicalCommand,"aggregateType"|"eventType"|"payload">):void{
 const p=c.payload as Record<string,unknown>|null;
 if(p===null||typeof p!=="object")return; // el kernel lo rechaza con su propio mensaje
 const kind=String(p["kind"]??"");
 const schema=PAYLOAD_SCHEMAS[payloadSchemaKey(c.aggregateType,kind)];
 if(!schema)return;
 const r=schema.safeParse(p);
 if(!r.success){
  const detalle=r.error.issues.map(i=>`${i.path.join(".")||"(raíz)"}: ${i.message}`).join("; ");
  throw new ClinicalError("VALIDATION_ERROR",`El payload del evento ${c.aggregateType}/${kind} no cumple su esquema: ${detalle}. No se escribe: la cadena de eventos es inmutable y un evento mal formado no se puede corregir después.`,{aggregateType:c.aggregateType,kind});
 }
}
