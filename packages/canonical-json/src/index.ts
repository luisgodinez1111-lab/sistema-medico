import{createHash}from"node:crypto";
import{uuidFromDigest}from"./uuid";
export function canonicalize(value:unknown):string{
 if(value===null||typeof value!=="object") return JSON.stringify(value);
 if(Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
 const x=value as Record<string,unknown>;
 return `{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(x[k])}`).join(",")}}`;
}


// El FORMATO vive en ./uuid (sin dependencias de Node, para el navegador); aquí solo la derivación con sha256.
export{uuidFromDigest}from"./uuid";

// Derivación canónica de un UUID a partir de una SEMILLA de texto. Es la ÚNICA implementación del repo: la auditoría
// (R01-015) encontró SIETE copias del mismo corte de sha256, tres de ellas con nibbles distintos, lo que hacía que el
// identificador escrito por un camino no coincidiera con el leído por otro (p. ej. el `eventId` del kernel frente al que
// buscaba el replay estable). Un test guardián impide que vuelva a haber más de una.
export function deterministicUuid(seed:string):string{
 return uuidFromDigest(createHash("sha256").update(seed).digest("hex"));
}

// Huella canónica de un cuerpo de comando: la que decide si un reintento es el MISMO comando (idempotencia) o uno
// distinto (409 IDEMPOTENCY_CONFLICT). Auditoría R01-022/R01-023: vivía en `packages/idempotent-command`, un paquete sin
// importadores en producción cuya versión aplanaba los objetos anidados —dos cuerpos distintos daban la misma huella—.
// Aquí queda junto a la canonicalización que usa el kernel, de modo que hay UNA sola definición de «el mismo comando».
export function canonicalHash(value:unknown):string{
 return createHash("sha256").update(canonicalize(value)).digest("hex");
}
