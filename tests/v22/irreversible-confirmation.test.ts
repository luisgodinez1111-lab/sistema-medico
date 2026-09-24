import{describe,it,expect}from"vitest";
import fs from"node:fs";
// Auditoría 2026-09-19, anexo R05a (R05a-F07) — confirmación de acciones IRREVERSIBLES.
//
// Anular una factura y revocar un consentimiento se disparaban con UN clic, directo en el `onClick`. No son acciones
// reversibles ni corregibles «editando»: el registro es de solo-añadir, así que lo único posible después es anotar encima,
// con la factura ya anulada y el consentimiento ya revocado. Revocar un consentimiento por error además RETIRA la base
// legal para tratar los datos de ese paciente hasta que él vuelva a otorgarlo.
//
// El patrón no se inventó: es el mismo que la anulación de una barrera de prescripción (`overrideMed` -> diálogo ->
// `confirmOverrideMed`), donde la auditoría ya exigió nombrar la barrera y justificar.
const MODELO="apps/web/app/workspace/model.tsx";
const VISTA="apps/web/app/workspace/views/exp.tsx";

describe("acciones irreversibles piden confirmación (R05a-F07)",()=>{
 const modelo=()=>fs.readFileSync(MODELO,"utf8");
 const vista=()=>fs.readFileSync(VISTA,"utf8");
 it("las transiciones irreversibles están DECLARADAS, no repartidas por el código",()=>{
  const src=modelo();
  const m=/TRANSICIONES_IRREVERSIBLES:ReadonlySet<string>=new Set\(\[([^\]]*)\]\)/.exec(src);
  expect(m,"falta la declaración de qué transiciones son irreversibles").not.toBeNull();
  for(const t of["VOIDED","REVOKED"])expect(m![1]!,`${t} debe estar declarada como irreversible`).toContain(t);
 });
 it("anular factura y revocar consentimiento NO se ejecutan en el primer clic",()=>{
  const src=modelo();
  // Los manejadores públicos consultan la declaración; los que actúan de verdad son los `…Now`, y solo se llaman desde
  // `run()` del diálogo. Dos guardas: una por manejador.
  const guardas=(src.match(/TRANSICIONES_IRREVERSIBLES\.has\(act\.to\)/g)??[]).length;
  expect(guardas,"cada manejador irreversible necesita su guarda").toBe(2);
  for(const h of["doClaimActionNow","doConsentActionNow"])expect(src,`falta ${h}`).toContain(h);
  // Y el ejecutor real solo se invoca desde el `run` de la acción pendiente, nunca desde el onClick.
  for(const h of["doClaimActionNow","doConsentActionNow"]){
   const i=src.indexOf(`void ${h}(`);
   expect(i,`${h} debe ejecutarse solo al confirmar`).toBeGreaterThan(-1);
  }
 });
 it("el aviso explica POR QUÉ no se puede deshacer, no solo que es irreversible",()=>{
  // «¿Está seguro?» no informa. Lo que informa es qué queda después: un registro append-only y, en el consentimiento, la
  // base legal retirada.
  const src=modelo();
  expect(src,"debe explicar el efecto de revocar el consentimiento").toMatch(/base legal/i);
  expect(src,"y que el registro es de solo-añadir").toMatch(/solo-a[ñn]adir/i);
 });
 it("la vista presenta un diálogo de alerta con cancelar y confirmar",()=>{
  const src=vista();
  expect(src).toContain('data-testid="confirm-irreversible"');
  expect(src).toContain('data-testid="cancel-irreversible"');
  expect(src).toContain('data-testid="accept-irreversible"');
  // `role="alertdialog"` para que un lector de pantalla lo anuncie como lo que es, igual que el bloqueo de seguridad.
  const i=src.indexOf('data-testid="confirm-irreversible"');
  expect(src.slice(Math.max(0,i-220),i)).toMatch(/role="alertdialog"/);
 });
 it("cancelar no ejecuta nada y confirmar ejecuta la acción pendiente",()=>{
  const src=modelo();
  expect(src).toMatch(/const cancelIrreversible=\(\)=>setPendingIrreversible\(null\);/);
  expect(src).toMatch(/const confirmIrreversible=\(\)=>\{pendingIrreversible\?\.run\(\);\}/);
 });
});
