// Formato canónico de UUID DERIVADO — sin dependencias de Node, para que valga igual en el servidor y en el navegador.
//
// Auditoría 2026-09-19, anexo R01 (R01-015): el repo tenía SIETE copias del mismo corte de sha256 en cinco tramos, tres
// con nibbles distintos, de modo que el identificador escrito por un camino no coincidía con el leído por otro (el
// `eventId` del kernel frente al que buscaba el replay estable). Este es el único sitio donde se da forma a un UUID.
//
// Versión 8 (RFC 9562 §5.8: «custom», la que corresponde a un identificador derivado de un hash y no aleatorio) y
// variante 10xx. Sin fijar esos nibbles, ~92 % de los identificadores emitidos no eran UUID válidos.
export function uuidFromDigest(hex:string):string{
 const b=hex.slice(0,32).split("");
 b[12]="8";                            // versión 8 = derivado / definido por la implementación
 b[16]="89ab"[parseInt(b[16]!,16)&3]!; // variante RFC 4122/9562
 const h=b.join("");
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}
