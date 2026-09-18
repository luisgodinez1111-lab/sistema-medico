export type EpistemicClass="FACT"|"DERIVED"|"INFERENCE"|"RECOMMENDATION"|"PHYSICIAN_DECISION"|"ORDER"|"SIGNED_RECORD"|"UNKNOWN"|"CONFLICTING";
export interface ClinicalComponentContract {
 id:string; authority:string[]; epistemic:EpistemicClass[]; patientContextRequired:boolean;
 states:readonly string[]; forbiddenStates:readonly string[]; anatomy:readonly string[];
 actions:readonly string[]; responsiveSafety:readonly string[]; accessibility:readonly string[];
 testIds:readonly string[];
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
 testIds:["result-card","result-state","result-value","result-action"]
};
