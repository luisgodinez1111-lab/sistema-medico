export function canonicalize(value:unknown):string{
 if(value===null||typeof value!=="object") return JSON.stringify(value);
 if(Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
 const x=value as Record<string,unknown>;
 return `{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(x[k])}`).join(",")}}`;
}

// UUID DERIVADO conforme a RFC 9562: los nibbles de versión (8 = «custom», el que corresponde a un identificador
// derivado de un hash, no aleatorio) y de variante (10xx) se fijan. Auditoría R01-015: antes se cortaba el sha256 en
// cinco tramos sin fijarlos, así que 92 % de los identificadores emitidos NO eran UUID válidos aunque la columna de
// Postgres y `z.string().uuid()` los aceptaran por casualidad en el resto.
export function uuidFromDigest(hex:string):string{
 const b=hex.slice(0,32).split("");
 b[12]="8";                                             // versión 8 (RFC 9562 §5.8: UUID derivado/definido por la implementación)
 b[16]="89ab"[parseInt(b[16]!,16)&3]!;                  // variante RFC 4122/9562 (10xx)
 const h=b.join("");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
