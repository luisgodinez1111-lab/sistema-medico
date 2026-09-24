import{describe,it,expect}from"vitest";
import fs from "node:fs";
import crypto from "node:crypto";
import{signatureDigest,signedPayload,verifySignature,SIGNATURE_FORMAT}from"../../apps/web/lib/clinical-signature";
import{transitionEncounter,type EncounterState}from"../../packages/encounter-domain/src";
import{runtimeSource}from"./_runtime-src";
// Auditoría 2026-09-19, anexo R02a — ENC-01 (la «fecha de registro» era la hora del cliente), ENC-02/DOC-02 (la identidad
// legal del firmante viajaba FUERA del sello y la firma estaba implementada dos veces) y ENC-03 (estados fantasma).
const BASE={aggregateId:"11111111-1111-4111-8111-111111111111",signedVersion:3,
 contentHash:"a".repeat(64),subject:"auth0|medico",signedAt:"2026-09-23T18:00:00.000Z"};
const CRED={fullName:"Dra. Ana Ruiz","cedulaProfesional":"1234567"} as const;

describe("sello de firma clínica (R02a-ENC-02, DOC-02)",()=>{
 it("la identidad legal del firmante ENTRA en el sello: cambiar la cédula cambia la huella",()=>{
  const conCedula=signatureDigest({...BASE,signer:CRED});
  const otraCedula=signatureDigest({...BASE,signer:{...CRED,cedulaProfesional:"7654321"}});
  const otroNombre=signatureDigest({...BASE,signer:{...CRED,fullName:"Dr. Otro"}});
  expect(conCedula).not.toBe(otraCedula);
  expect(conCedula).not.toBe(otroNombre);
 });
 it("el sello del formato anterior (sin identidad) era ciego a ese cambio: así se ve lo que se arregló",()=>{
  const v1=(cedula:string)=>crypto.createHash("sha256")
   .update(`${BASE.aggregateId}:${BASE.signedVersion}:${BASE.contentHash}:${BASE.subject}:${BASE.signedAt}`).digest("hex")+cedula.slice(0,0);
  expect(v1("1234567")).toBe(v1("7654321")); // la cédula no influía
 });
 it("cada campo del sello importa: agregado, versión, contenido, sujeto y hora",()=>{
  const base=signatureDigest({...BASE,signer:CRED});
  expect(signatureDigest({...BASE,signer:CRED,aggregateId:"22222222-2222-4222-8222-222222222222"})).not.toBe(base);
  expect(signatureDigest({...BASE,signer:CRED,signedVersion:4})).not.toBe(base);
  expect(signatureDigest({...BASE,signer:CRED,contentHash:"b".repeat(64)})).not.toBe(base);
  expect(signatureDigest({...BASE,signer:CRED,subject:"auth0|otro"})).not.toBe(base);
  expect(signatureDigest({...BASE,signer:CRED,signedAt:"2026-09-23T18:00:01.000Z"})).not.toBe(base);
 });
 it("es determinista (el replay de una firma devuelve el MISMO sello)",()=>{
  expect(signatureDigest({...BASE,signer:CRED})).toBe(signatureDigest({...BASE,signer:CRED}));
 });
 it("los campos van nombrados y separados por línea: un valor con «:» no puede falsear otro campo",()=>{
  // Con el separador ":" plano, un contentHash que contuviera ":" podía desplazar los campos siguientes.
  const a=signatureDigest({...BASE,signer:CRED,subject:"a:b"});
  const b=signatureDigest({...BASE,signer:CRED,subject:"a",contentHash:`b:${BASE.contentHash}`});
  expect(a).not.toBe(b);
 });
 it("el payload del evento declara el formato del sello y la hora es del SERVIDOR",()=>{
  const p=signedPayload({...BASE,signer:CRED,clientOccurredAt:"2026-02-01T00:00:00.000Z"});
  expect(p["signatureFormat"]).toBe(SIGNATURE_FORMAT);
  expect(p["signedAtSource"]).toBe("SERVER");
  expect(p["signedAt"]).toBe(BASE.signedAt);
  expect(p["clientOccurredAt"]).toBe("2026-02-01T00:00:00.000Z"); // la del cliente, solo como dato forense
  expect(p["kind"]).toBe("SIGNED");
 });
 it("verifySignature recalcula y detecta una alteración del firmante",()=>{
  const p=signedPayload({...BASE,signer:CRED});
  expect(verifySignature(p,BASE.aggregateId)).toBe(true);
  const alterado={...p,signer:{fullName:"Dr. Suplantador",cedulaProfesional:"9999999"}};
  expect(verifySignature(alterado,BASE.aggregateId)).toBe(false);
  expect(verifySignature({...p,contentHash:"b".repeat(64)},BASE.aggregateId)).toBe(false);
 });
 it("sigue verificando las firmas del formato anterior (no invalida lo ya firmado)",()=>{
  const v1={signatureFormat:"medos-sig-v1",signedVersion:BASE.signedVersion,contentHash:BASE.contentHash,
   authorId:BASE.subject,signedAt:BASE.signedAt,
   signatureDigest:crypto.createHash("sha256").update(`${BASE.aggregateId}:${BASE.signedVersion}:${BASE.contentHash}:${BASE.subject}:${BASE.signedAt}`).digest("hex")};
  expect(verifySignature(v1,BASE.aggregateId)).toBe(true);
 });
 it("hay UNA sola implementación del sello: los lifecycles no vuelven a calcularlo a mano",()=>{
  for(const f of ["apps/web/lib/encounter-lifecycle.ts","apps/web/lib/document-lifecycle.ts"]){
   const src=fs.readFileSync(f,"utf8");
   expect(src,`${f} debe usar el sello compartido`).toContain("signedPayload(");
   expect(src,`${f} no debe recalcular el sello`).not.toMatch(/signatureDigest:crypto\.createHash/);
  }
 });
});

describe("hora de registro frente a hora del hecho (R02a-ENC-01)",()=>{
 it("ninguna lectura vuelve a presentar el occurred_at del cliente como «recordedAt»",()=>{
  expect(runtimeSource()).not.toContain("occurred_at as recorded_at");
 });
 it("las lecturas que informan «fecha de registro» leen la columna del reloj del servidor",()=>{
  const src=runtimeSource();
  expect((src.match(/recorded_at as recorded_at/g)??[]).length).toBeGreaterThanOrEqual(4);
 });
 it("la columna existe en el esquema con el reloj del servidor por defecto",()=>{
  expect(fs.readFileSync("db/migrations/0001_core.sql","utf8")).toMatch(/recorded_at timestamptz NOT NULL DEFAULT now\(\)/);
 });
});

describe("la máquina del encuentro solo declara estados alcanzables (R02a-ENC-03)",()=>{
 it("AMENDED, CANCELLED y PLANNED ya no existen como estados del encuentro",()=>{
  const src=fs.readFileSync("packages/encounter-domain/src/index.ts","utf8");
  const tipo=/export type EncounterState=([^;]+);/.exec(src)?.[1]??"";
  expect(tipo).not.toMatch(/AMENDED|CANCELLED|PLANNED/);
  for(const s of ["OPEN","READY_TO_SIGN","SIGNED"])expect(tipo).toContain(s);
 });
 it("todo destino declarado es alcanzable por un kind que el fold reconoce",()=>{
  const fold=fs.readFileSync("packages/encounter-fold/src/index.ts","utf8");
  for(const estado of ["OPEN","READY_TO_SIGN","SIGNED"] as EncounterState[]){
   // cada estado lo produce un case del fold
   expect(fold,`el fold debe producir ${estado}`).toContain(`status="${estado}"`);
  }
 });
 it("firmado es terminal y no se puede volver atrás",()=>{
  expect(()=>transitionEncounter("SIGNED","OPEN" as EncounterState)).toThrow(/ILLEGAL/);
  expect(()=>transitionEncounter("SIGNED","READY_TO_SIGN")).toThrow(/ILLEGAL/);
  expect(transitionEncounter("OPEN","READY_TO_SIGN")).toBe("READY_TO_SIGN");
  expect(transitionEncounter("READY_TO_SIGN","SIGNED")).toBe("SIGNED");
 });
});

describe("texto clínico y vínculos declarados (R02a-ENC-04, DOC-03)",()=>{
 it("valoración y plan no aceptan espacios en blanco ni texto sin fin (el mínimo es «no vacío», no una longitud clínica)",()=>{
  const src=fs.readFileSync("apps/web/lib/encounter-lifecycle.ts","utf8");
  expect(src).toMatch(/assessment:z\.string\(\)\.trim\(\)\.min\(1/);
  expect(src).toMatch(/plan:z\.string\(\)\.trim\(\)\.min\(1/);
  expect(src).toMatch(/max\(CLINICAL_TEXT_MAX\)/);
 });
 it("el documento valida el encuentro que declara: debe existir y ser del mismo paciente",()=>{
  const src=fs.readFileSync("apps/web/lib/document-lifecycle.ts","utf8");
  expect(src).toMatch(/ENCOUNTER_PATIENT_MISMATCH/);
  expect(src).toMatch(/El encuentro declarado no existe/);
  expect(src).toMatch(/title:z\.string\(\)\.trim\(\)\.min\(1/);
 });
});
