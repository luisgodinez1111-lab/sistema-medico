import{receipt,type CalcStatus}from"../../../packages/calculation-receipt/src";
// Auditoría 2026-09-19, anexo R03 (R03-37 y vacío F12) — RECIBO DE CÁLCULO.
//
// El anexo encontró TRES paquetes-fachada que definían exactamente el contrato que faltaba y que nadie importaba:
// `calculation-engine` (CalcResult con los cuatro estados de fallo + algorithm/version/inputsHash),
// `clinical-numeric` (validateNumeric con UNIT_REQUIRED / BELOW_SUPPORTED_RANGE) y `calculation-receipt` (el hash de
// entradas ya implementado). «El diseño correcto existe escrito y el código real devuelve undefined.»
//
// Resolución: los dos primeros se RETIRAN —lo que prometían ya lo entregan los paquetes reales: los estados de fallo
// viven en los `*Check` de cada calculadora (curb65Check, acidBaseCheck, egfrCheck, schwartzCheck…) y la validación de
// unidad y plausibilidad en `normalizeLabValue` / `normalizeVitalMeasure`, que sí tienen tablas de unidades de verdad—.
// El tercero se CABLEA aquí, porque aporta lo único que seguía faltando: el HASH DE LAS ENTRADAS, que ata un resultado
// a los datos exactos con los que se calculó. Sin él, un resultado no se puede reproducir ni auditar a posteriori.
export type CalcAlgorithm=Readonly<{id:string;version:string;authority?:string}>;
export type CalcReceipt=Readonly<{algorithm:string;version:string;authority?:string;inputHash:string;status:CalcStatus;at:string;value?:unknown}>;
/**
 * Recibo del cálculo: algoritmo, versión, autoridad clínica, HASH canónico de las entradas, estado y momento.
 * `input` debe contener TODO lo que entró al cálculo (valores, unidades, fechas de las lecturas): es lo que hace que el
 * hash sirva para reproducirlo.
 */
export function calcReceipt(alg:CalcAlgorithm,input:unknown,status:CalcStatus,value?:unknown):CalcReceipt{
 const r=receipt(alg.id,alg.version,input,status,value);
 return alg.authority===undefined?r:{...r,authority:alg.authority};
}
