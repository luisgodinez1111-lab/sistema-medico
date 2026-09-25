import{describe,it,expect}from"vitest";
import{aboRhCompatible,verifyBedside,TRANSFUSION_SAFETY_LIMITS,type AboGroup,type BloodGroup}from"../../packages/transfusion-safety/src";
// Auditoría 2026-09-19, anexo R02b (R2B-017) — COMPATIBILIDAD ABO/Rh Y DOBLE VERIFICACIÓN.
//
// EL HALLAZGO: el ciclo de vida de transfusión tenía la transición «pruebas cruzadas» y la transición «iniciar», y ninguna
// registraba nada más que una fecha. Ni el grupo del receptor, ni el de la unidad, ni quién verificó. La reacción hemolítica
// aguda por incompatibilidad ABO es el error transfusional catastrófico clásico, y la barrera que lo evita es siempre la
// misma: comprobar el grupo de la unidad contra el del receptor, al pie de cama, por dos personas distintas.
//
// Las verticales hospitalarias siguen APAGADAS por bandera (404 en el borde), así que el riesgo no estaba vivo; lo que esto
// impide es que encenderlas exponga una transfusión sin barrera.
const G=(abo:AboGroup,rh:"POSITIVE"|"NEGATIVE"):BloodGroup=>({abo,rh});
const TODOS:AboGroup[]=["O","A","B","AB"];

describe("compatibilidad ABO de eritrocitos (R2B-017)",()=>{
 it("O negativo sirve a cualquier receptor: es el dador universal de eritrocitos",()=>{
  for(const abo of TODOS)for(const rh of ["POSITIVE","NEGATIVE"] as const)
   expect(aboRhCompatible(G(abo,rh),G("O","NEGATIVE"),"PRBC").compatible,`receptor ${abo}${rh}`).toBe(true);
 });
 it("AB positivo puede recibir de cualquiera: es el receptor universal",()=>{
  for(const abo of TODOS)for(const rh of ["POSITIVE","NEGATIVE"] as const)
   expect(aboRhCompatible(G("AB","POSITIVE"),G(abo,rh),"PRBC").compatible,`unidad ${abo}${rh}`).toBe(true);
 });
 it("EL CASO CATASTRÓFICO: un receptor O no puede recibir A, B ni AB",()=>{
  for(const unidad of ["A","B","AB"] as AboGroup[]){
   const v=aboRhCompatible(G("O","POSITIVE"),G(unidad,"POSITIVE"),"PRBC");
   expect(v.compatible,`O recibiendo ${unidad}`).toBe(false);
   expect(v.reason,"la razón tiene que nombrar el riesgo, no solo decir «incompatible»").toMatch(/hemol/i);
  }
 });
 it("un receptor A no recibe B ni AB; un receptor B no recibe A ni AB",()=>{
  expect(aboRhCompatible(G("A","POSITIVE"),G("B","POSITIVE"),"PRBC").compatible).toBe(false);
  expect(aboRhCompatible(G("A","POSITIVE"),G("AB","POSITIVE"),"PRBC").compatible).toBe(false);
  expect(aboRhCompatible(G("B","POSITIVE"),G("A","POSITIVE"),"PRBC").compatible).toBe(false);
  expect(aboRhCompatible(G("B","POSITIVE"),G("AB","POSITIVE"),"PRBC").compatible).toBe(false);
  // Y sí recibe de O y de su propio grupo.
  expect(aboRhCompatible(G("A","POSITIVE"),G("A","POSITIVE"),"PRBC").compatible).toBe(true);
  expect(aboRhCompatible(G("B","POSITIVE"),G("O","POSITIVE"),"PRBC").compatible).toBe(true);
 });
 it("un receptor Rh NEGATIVO no recibe unidades Rh positivas",()=>{
  const v=aboRhCompatible(G("A","NEGATIVE"),G("O","POSITIVE"),"PRBC");
  expect(v.compatible).toBe(false);
  expect(v.reason).toMatch(/Rh incompatible/);
  // Al revés sí: un Rh positivo puede recibir Rh negativo.
  expect(aboRhCompatible(G("A","POSITIVE"),G("O","NEGATIVE"),"PRBC").compatible).toBe(true);
 });
});

describe("plasma: la compatibilidad es la INVERSA (R2B-017)",()=>{
 it("el plasma AB sirve a todos, y el plasma O solo al receptor O",()=>{
  // Es el error conceptual más común: aplicar la tabla de eritrocitos al plasma. Con plasma se transfunden los ANTICUERPOS
  // del donante, así que la dirección se invierte.
  for(const abo of TODOS)expect(aboRhCompatible(G(abo,"POSITIVE"),G("AB","POSITIVE"),"FFP").compatible,`receptor ${abo}`).toBe(true);
  expect(aboRhCompatible(G("O","POSITIVE"),G("O","POSITIVE"),"FFP").compatible).toBe(true);
  for(const r of ["A","B","AB"] as AboGroup[])expect(aboRhCompatible(G(r,"POSITIVE"),G("O","POSITIVE"),"FFP").compatible,`receptor ${r} con plasma O`).toBe(false);
 });
 it("la regla aplicada se declara, para que se pueda auditar cuál se usó",()=>{
  expect(aboRhCompatible(G("A","POSITIVE"),G("A","POSITIVE"),"PRBC").rule).toBe("RED_CELLS");
  expect(aboRhCompatible(G("A","POSITIVE"),G("A","POSITIVE"),"FFP").rule).toBe("PLASMA");
  expect(aboRhCompatible(G("A","POSITIVE"),G("A","POSITIVE"),"CRYO").rule).toBe("PLASMA");
  expect(aboRhCompatible(G("A","POSITIVE"),G("A","POSITIVE"),"WHOLE_BLOOD").rule).toBe("WHOLE_BLOOD");
 });
 it("la sangre completa exige ABO IDÉNTICO, no solo compatible",()=>{
  expect(aboRhCompatible(G("A","POSITIVE"),G("O","POSITIVE"),"WHOLE_BLOOD").compatible,"O no sirve como sangre completa a un A").toBe(false);
  expect(aboRhCompatible(G("A","POSITIVE"),G("A","POSITIVE"),"WHOLE_BLOOD").compatible).toBe(true);
 });
});

describe("verificación al pie de cama (R2B-017)",()=>{
 const base={recipient:G("A","POSITIVE"),unit:G("O","NEGATIVE"),product:"PRBC" as const,unitId:"U-12345",verifiedBy:["QFB Ana Ruiz","Enf. Luis Prado"] as [string,string]};
 it("compatible, dos verificadores distintos y unidad identificada: pasa",()=>{
  const v=verifyBedside(base);
  expect(v.ok).toBe(true);
  expect(v.blockers).toEqual([]);
 });
 it("LA MISMA PERSONA no puede ser la doble verificación",()=>{
  // Es el corazón de la barrera: el doble chequeo existe precisamente porque una sola persona se equivoca.
  const v=verifyBedside({...base,verifiedBy:["QFB Ana Ruiz","QFB Ana Ruiz"]});
  expect(v.ok).toBe(false);
  expect(v.blockers.join(" ")).toMatch(/DISTINTOS/);
 });
 it("sin dos verificadores identificados no hay verificación",()=>{
  expect(verifyBedside({...base,verifiedBy:["QFB Ana Ruiz",""]}).ok).toBe(false);
  expect(verifyBedside({...base,verifiedBy:["","  "]}).blockers.join(" ")).toMatch(/DOS_VERIFICADORES/);
 });
 it("sin número de unidad no hay trazabilidad de qué se transfundió",()=>{
  const v=verifyBedside({...base,unitId:"  "});
  expect(v.ok).toBe(false);
  expect(v.blockers.join(" ")).toMatch(/UNIDAD_SIN_IDENTIFICAR/);
 });
 it("una incompatibilidad bloquea aunque el resto esté perfecto",()=>{
  const v=verifyBedside({...base,recipient:G("O","POSITIVE"),unit:G("A","POSITIVE")});
  expect(v.ok).toBe(false);
  expect(v.blockers.join(" ")).toMatch(/ABO_RH_INCOMPATIBLE/);
  expect(v.compatibility.compatible).toBe(false);
 });
 it("y todos los problemas se reportan juntos, no solo el primero",()=>{
  const v=verifyBedside({...base,recipient:G("O","POSITIVE"),unit:G("B","POSITIVE"),unitId:"",verifiedBy:["x","x"]});
  expect(v.blockers.length).toBe(3);
 });
 it("el módulo declara lo que NO cubre",()=>{
  // Sin esto, «seguridad transfusional implementada» se leería como completa.
  expect(TRANSFUSION_SAFETY_LIMITS).toMatch(/anticuerpos irregulares/);
  expect(TRANSFUSION_SAFETY_LIMITS).toMatch(/neonatos/);
  expect(TRANSFUSION_SAFETY_LIMITS).toMatch(/ADR-0300/);
 });
});
