export type EncounterState="PLANNED"|"OPEN"|"READY_TO_SIGN"|"SIGNED"|"AMENDED"|"CANCELLED";
const allowed:Record<EncounterState,readonly EncounterState[]>={PLANNED:["OPEN","CANCELLED"],OPEN:["READY_TO_SIGN","CANCELLED"],READY_TO_SIGN:["OPEN","SIGNED"],SIGNED:["AMENDED"],AMENDED:[],CANCELLED:[]};
export function transitionEncounter(from:EncounterState,to:EncounterState){if(!allowed[from].includes(to))throw new Error(`ILLEGAL_ENCOUNTER_TRANSITION:${from}:${to}`);return to;}
