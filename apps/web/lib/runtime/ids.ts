// Hallazgo D8 del lote 11 — identificadores de agregado. Tienen la forma del tipo `uuid` de PostgreSQL (8-4-4-4-12 hexadecimal):
// un id con otra forma no puede existir, así que ninguna lectura lo lleva a la base (antes PostgreSQL respondía 22P02 y la API
// un 500 INTERNAL, o una comparación de texto devolvía un 200 vacío). No se exigen los bits de versión de RFC 9562
// (`z.string().uuid()`): los ids que deriva el servidor (`derivedUuid`, p. ej. las obligaciones de monitoreo) no los llevan.
import{z}from"zod";
const AggregateId=z.guid();
export const isAggregateId=(v:unknown):v is string=>AggregateId.safeParse(v).success;
