import crypto from "node:crypto";
import type{PhysicianCredentials}from"./physician-profile-lifecycle";
// Auditoría 2026-09-19, anexo R02a (ENC-02, DOC-02) — SELLO DE FIRMA CLÍNICA, en un solo sitio.
//
// Dos problemas que arreglaba este módulo:
//
// 1. **La identidad legal del firmante no entraba en el sello.** El digest era
//    `aggregateId:version:contentHash:subject:signedAt`. La cédula profesional y el nombre viajaban en el payload del
//    evento (L-05), pero fuera del hash: alterar «quién firmó, con qué cédula» en una copia del expediente no rompía la
//    huella. En un documento médico-legal la identidad del firmante ES parte de lo firmado (LGS art. 83: los documentos
//    del profesional consignan la institución que expidió el título y el número de cédula).
//
// 2. **La corrección se había hecho por duplicado**, en `encounter-lifecycle` y en `document-lifecycle`, con dos copias
//    del mismo `createHash(...)`. Dos copias de un sello es la forma de que dentro de un año haya dos sellos distintos.
//
// El sello incluye la VERSIÓN del formato: si algún día cambia lo que se sella, las firmas antiguas siguen verificándose
// con su propia versión en vez de «dejar de cuadrar» en silencio.
export const SIGNATURE_FORMAT="medos-sig-v2" as const;

export type SignatureInput=Readonly<{
 aggregateId:string;
 /** Versión del agregado que se firma (la que el cliente declaró con If-Match). */
 signedVersion:number;
 /** Huella del contenido mostrado al médico (L-03: se compara contra lo persistido antes de firmar). */
 contentHash:string;
 /** Sujeto OIDC del médico autenticado: la firma la produce una persona, nunca la IA (Physician Control). */
 subject:string;
 /** Hora del SERVIDOR (L-02): la del cliente solo se conserva como dato forense. */
 signedAt:string;
 /** Identidad legal registrada del firmante. `undefined` no llega a firmar: el handler exige la cédula (428). */
 signer?:Pick<PhysicianCredentials,"fullName"|"cedulaProfesional">|undefined;
}>;

/** Huella de la firma. Determinista: los mismos datos producen el mismo sello (imprescindible para el replay). */
export function signatureDigest(i:SignatureInput):string{
 // Los campos van separados por "\n" y cada uno con su nombre: así añadir un campo nuevo no puede colisionar con el
 // contenido de otro (el separador ":" lo permitía si un valor contenía ":").
 const partes=[
  `format=${SIGNATURE_FORMAT}`,
  `aggregate=${i.aggregateId}`,
  `version=${i.signedVersion}`,
  `content=${i.contentHash}`,
  `subject=${i.subject}`,
  `signedAt=${i.signedAt}`,
  `signerName=${i.signer?.fullName??""}`,
  `cedula=${i.signer?.cedulaProfesional??""}`,
 ];
 return crypto.createHash("sha256").update(partes.join("\n")).digest("hex");
}

/** Payload del evento SIGNED, idéntico para encuentro y documento (antes eran dos copias divergentes). */
export function signedPayload(i:SignatureInput&Readonly<{clientOccurredAt?:string|undefined}>):Record<string,unknown>{
 return{
  kind:"SIGNED",
  authorId:i.subject,
  ...(i.signer?{signer:{fullName:i.signer.fullName,cedulaProfesional:i.signer.cedulaProfesional}}:{}),
  contentHash:i.contentHash,
  signedAt:i.signedAt,
  signedAtSource:"SERVER",
  ...(i.clientOccurredAt!==undefined?{clientOccurredAt:i.clientOccurredAt}:{}),
  signedVersion:i.signedVersion,
  signatureFormat:SIGNATURE_FORMAT,
  signatureDigest:signatureDigest(i),
 };
}

/**
 * Verifica una firma persistida recalculando su huella con el formato que ella misma declara.
 * `medos-sig-v1` (sin identidad del firmante en el hash) se sigue verificando para no invalidar lo ya firmado.
 */
export function verifySignature(payload:Readonly<Record<string,unknown>>,aggregateId:string):boolean{
 const formato=String(payload["signatureFormat"]??"medos-sig-v1");
 const digest=String(payload["signatureDigest"]??"");
 const signedVersion=Number(payload["signedVersion"]??NaN);
 const contentHash=String(payload["contentHash"]??"");
 const subject=String(payload["authorId"]??"");
 const signedAt=String(payload["signedAt"]??"");
 if(!digest||!Number.isFinite(signedVersion))return false;
 if(formato==="medos-sig-v1"){
  const v1=crypto.createHash("sha256").update(`${aggregateId}:${signedVersion}:${contentHash}:${subject}:${signedAt}`).digest("hex");
  return v1===digest;
 }
 const signer=payload["signer"] as{fullName?:unknown;cedulaProfesional?:unknown}|undefined;
 return signatureDigest({aggregateId,signedVersion,contentHash,subject,signedAt,
  ...(signer?{signer:{fullName:String(signer.fullName??""),cedulaProfesional:String(signer.cedulaProfesional??"")}}:{})})===digest;
}
