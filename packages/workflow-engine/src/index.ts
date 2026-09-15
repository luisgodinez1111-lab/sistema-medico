export type StepState="PENDING"|"RUNNING"|"SUCCEEDED"|"FAILED"|"COMPENSATING"|"COMPENSATED";
export type Step=Readonly<{id:string;state:StepState;attempts:number;maxAttempts:number;owner:string}>;
export function failStep(s:Step){const attempts=s.attempts+1;return Object.freeze({...s,attempts,state:(attempts>=s.maxAttempts?"FAILED":"PENDING") as StepState});}
export function requireOwner(s:Step){if(!s.owner)throw new Error("WORKFLOW_OWNER_REQUIRED");return true;}
