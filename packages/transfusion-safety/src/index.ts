// Seguridad transfusional: compatibilidad ABO/Rh y doble verificación al pie de cama. Puro, sin PHI (recibe grupos, no ids).
//
// Auditoría 2026-09-19, anexo R02b (R2B-017) — NO EXISTÍA NINGUNA VERIFICACIÓN ABO/Rh NI DOBLE CHEQUEO.
//
// El ciclo de vida de transfusión tenía la transición «pruebas cruzadas» y la transición «iniciar», y ninguna de las dos
// registraba NADA más que una fecha: ni el grupo del receptor, ni el de la unidad, ni quién verificó. La reacción
// hemolítica aguda por incompatibilidad ABO es el error transfusional catastrófico clásico, y la barrera que lo evita en
// cualquier banco de sangre del mundo es exactamente ésta: comprobar el grupo de la unidad contra el del receptor, al pie
// de cama, por DOS personas distintas, antes de conectar.
//
// QUÉ SE IMPLEMENTA Y QUÉ NO. Se implementa la BARRERA: la tabla de compatibilidad —que no es contenido opinable, es la
// misma en toda la medicina transfusional— y la exigencia de dos verificadores distintos e identificados. NO se implementa
// el resto de la seguridad transfusional (anticuerpos irregulares, fenotipo extendido, irradiación, leucorreducción,
// transfusión masiva, pediatría y neonatos), y el módulo lo dice: sigue pendiente de la validación clínica de ADR-0300 y
// las verticales hospitalarias siguen apagadas por bandera.
export type AboGroup="O"|"A"|"B"|"AB";
export type RhFactor="POSITIVE"|"NEGATIVE";
export type BloodGroup=Readonly<{abo:AboGroup;rh:RhFactor}>;
export type BloodProduct="PRBC"|"PLATELETS"|"FFP"|"CRYO"|"WHOLE_BLOOD";
/** Antígenos ABO que porta cada grupo: lo que el plasma del receptor puede atacar. */
const ANTIGENOS:Readonly<Record<AboGroup,readonly AboGroup[]>>={O:[],A:["A"],B:["B"],AB:["A","B"]};
/** Grupos ABO cuyos eritrocitos puede recibir cada receptor (el receptor no debe tener anticuerpos contra el antígeno). */
const ERITROCITOS_COMPATIBLES:Readonly<Record<AboGroup,readonly AboGroup[]>>={
 O:["O"],A:["O","A"],B:["O","B"],AB:["O","A","B","AB"],
};
/** Plasma compatible: es el INVERSO del de eritrocitos, porque lo que se transfunde son los anticuerpos del donante. */
const PLASMA_COMPATIBLE:Readonly<Record<AboGroup,readonly AboGroup[]>>={
 O:["O","A","B","AB"],A:["A","AB"],B:["B","AB"],AB:["AB"],
};
const ES_PLASMA=(p:BloodProduct):boolean=>p==="FFP"||p==="CRYO";
export type CompatibilityVerdict=Readonly<{
 compatible:boolean;
 /** Motivo en lenguaje clínico. Cuando NO es compatible, dice exactamente qué choca. */
 reason:string;
 /** Regla aplicada: eritrocitos, plasma o sangre completa (que exige ABO idéntico). */
 rule:"RED_CELLS"|"PLASMA"|"WHOLE_BLOOD";
}>;
/**
 * ¿Es compatible la unidad con el receptor para ese producto?
 * - Eritrocitos (PRBC, plaquetas): el receptor no puede tener anticuerpos contra el antígeno ABO de la unidad; Rh− no
 *   recibe Rh+ (regla conservadora, la que aplica a mujeres en edad fértil y a cualquier paciente sin fenotipo conocido).
 * - Plasma (FFP, crioprecipitado): la compatibilidad es la inversa, porque se transfunden los anticuerpos del donante.
 * - Sangre completa: exige ABO IDÉNTICO y Rh compatible.
 */
export function aboRhCompatible(recipient:BloodGroup,unit:BloodGroup,product:BloodProduct):CompatibilityVerdict{
 const rhOk=unit.rh==="NEGATIVE"||recipient.rh==="POSITIVE";
 const rhMsg=rhOk?"":`Rh incompatible: el receptor es Rh negativo y la unidad es Rh positivo`;
 if(product==="WHOLE_BLOOD"){
  const ok=recipient.abo===unit.abo&&rhOk;
  return{compatible:ok,rule:"WHOLE_BLOOD",
   reason:ok?`Sangre completa ${unit.abo}${unit.rh==="POSITIVE"?"+":"−"} con receptor idéntico`
    :recipient.abo!==unit.abo?`Sangre completa exige ABO IDÉNTICO: receptor ${recipient.abo}, unidad ${unit.abo}`:rhMsg};
 }
 if(ES_PLASMA(product)){
  const ok=PLASMA_COMPATIBLE[recipient.abo].includes(unit.abo);
  return{compatible:ok,rule:"PLASMA",
   reason:ok?`Plasma ${unit.abo} compatible con receptor ${recipient.abo}`
    :`Plasma ${unit.abo} INCOMPATIBLE con receptor ${recipient.abo}: el plasma del donante lleva anticuerpos anti-${ANTIGENOS[recipient.abo].join(" y anti-")||"A y anti-B"}`};
 }
 const aboOk=ERITROCITOS_COMPATIBLES[recipient.abo].includes(unit.abo);
 const ok=aboOk&&rhOk;
 return{compatible:ok,rule:"RED_CELLS",
  reason:ok?`Unidad ${unit.abo}${unit.rh==="POSITIVE"?"+":"−"} compatible con receptor ${recipient.abo}${recipient.rh==="POSITIVE"?"+":"−"}`
   :!aboOk?`ABO INCOMPATIBLE: el receptor ${recipient.abo} tiene anticuerpos contra el antígeno ${unit.abo} de la unidad — riesgo de reacción hemolítica aguda`:rhMsg};
}
export type BedsideCheck=Readonly<{
 recipient:BloodGroup;unit:BloodGroup;product:BloodProduct;unitId:string;
 /** Los DOS verificadores, identificados y distintos. Es el corazón de la barrera: una sola persona no basta. */
 verifiedBy:readonly [string,string];
}>;
export type BedsideVerdict=Readonly<{ok:boolean;blockers:readonly string[];compatibility:CompatibilityVerdict}>;
/** Verificación al pie de cama: compatibilidad + dos verificadores distintos + identificación de la unidad. */
export function verifyBedside(c:BedsideCheck):BedsideVerdict{
 const compatibility=aboRhCompatible(c.recipient,c.unit,c.product);
 const blockers:string[]=[];
 if(!compatibility.compatible)blockers.push(`ABO_RH_INCOMPATIBLE: ${compatibility.reason}`);
 const [a,b]=c.verifiedBy;
 if(!a?.trim()||!b?.trim())blockers.push("DOS_VERIFICADORES_REQUERIDOS: la comprobación al pie de cama la firman dos personas identificadas");
 else if(a.trim()===b.trim())blockers.push("VERIFICADORES_DEBEN_SER_DISTINTOS: la misma persona no puede ser la doble verificación");
 if(!c.unitId?.trim())blockers.push("UNIDAD_SIN_IDENTIFICAR: sin el número de la unidad no hay trazabilidad de qué se transfundió");
 return{ok:blockers.length===0,blockers,compatibility};
}
/** Lo que este módulo NO cubre, para que nadie lo suponga cubierto. */
export const TRANSFUSION_SAFETY_LIMITS="Cubre compatibilidad ABO/Rh y doble verificación al pie de cama. NO cubre anticuerpos irregulares, fenotipo extendido, irradiación o leucorreducción, protocolo de transfusión masiva, ni las reglas propias de pediatría y neonatos. Pendiente de la validación clínica declarada en ADR-0300.";
