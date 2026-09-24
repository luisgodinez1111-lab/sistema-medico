export type EpistemicClass="FACT"|"DERIVED"|"INFERENCE"|"RECOMMENDATION"|"PHYSICIAN_DECISION"|"ORDER"|"SIGNED_RECORD"|"UNKNOWN"|"CONFLICTING";
export interface ClinicalComponentContract {
 id:string; authority:string[]; epistemic:EpistemicClass[]; patientContextRequired:boolean;
 states:readonly string[]; forbiddenStates:readonly string[]; anatomy:readonly string[];
 actions:readonly string[]; responsiveSafety:readonly string[]; accessibility:readonly string[];
 testIds:readonly string[];
 actionsSurfaced?:readonly string[];
 actionsPending?:readonly string[];
}
export const resultCard:ClinicalComponentContract={
 id:"ResultCard",authority:["source-result","physician-action"],epistemic:["FACT","UNKNOWN","CONFLICTING"],
 patientContextRequired:true,
 states:["RECEIVED","FINAL_NORMAL","FINAL_ABNORMAL","CRITICAL_OPEN","ACKNOWLEDGED","ACTIONED","CORRECTED","SUPERSEDED","CONFLICTING","STALE"],
 forbiddenStates:["CRITICAL_OPEN+NORMAL_STYLE","CORRECTED+ORIGINAL_DELETED"],
 anatomy:["identity","test-name","value","unit","range","source","effective-time","state","actions","provenance"],
 actions:["open","acknowledge","act","resolve-linked-obligation"],
 responsiveSafety:["critical-state-never-hidden","unit-remains-associated-with-value"],
 accessibility:["state-not-color-only","value-unit-announced-together"],
 // Auditoría R09-018 (2026-09-24): este contrato declaraba `result-action`, un testid que NO existe en la UI. La acción
 // sí existe —resolver la obligación ligada al resultado— pero se llama `btn-resolve`. El contrato había derivado porque
 // nada lo comprobaba: ahora `tests/v22/design-contract-wiring.test.ts` exige que todo testid declarado exista.
 testIds:["result-card","result-state","result-value","btn-resolve"],
 // Y lo que el contrato pide y la tarjeta AÚN no expone, dicho aquí en vez de escondido tras un testid que nadie miraba:
 // de `actions`, la UI ofrece «resolver la obligación ligada»; `open`, `acknowledge` y `act` viven en el ciclo de vida del
 // resultado (RECEIVED -> VERIFIED -> ACTIONED -> CLOSED) y no como acciones de la tarjeta. Es un hueco de diseño, no un
 // defecto de implementación, y le toca al dueño decidir si la tarjeta debe exponerlas.
 actionsSurfaced:["resolve-linked-obligation"],
 actionsPending:["open","acknowledge","act"]
};

// R09-018: el registro que los tests consumen. Hoy hay un contrato de componente; cuando se añada otro, entra aquí y el
// guardarraíl lo comprueba solo (testids que existan, acciones separadas en expuestas y pendientes).
export const componentAnatomyContracts:readonly ClinicalComponentContract[]=[resultCard];
