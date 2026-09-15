
export type ActionClass="READ"|"DRAFT"|"SUGGEST"|"ORDER"|"PRESCRIBE"|"SIGN"|"CLOSE_CRITICAL"|"AMEND_SIGNED";
export type Actor="PHYSICIAN"|"STAFF"|"SYSTEM"|"AI";
const physicianOnly=new Set<ActionClass>(["PRESCRIBE","SIGN","AMEND_SIGNED"]);
export function authorizeClinicalAction(actor:Actor,action:ActionClass){
 if(physicianOnly.has(action)&&actor!=="PHYSICIAN") throw new Error(`PHYSICIAN_AUTHORITY_REQUIRED:${action}`);
 if(actor==="AI" && ["ORDER","CLOSE_CRITICAL"].includes(action)) throw new Error(`AI_IRREVERSIBLE_ACTION_BLOCKED:${action}`);
 return true;
}
