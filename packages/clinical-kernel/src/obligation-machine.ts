
import { StateMachineDefinition } from "./state-machine";
export const ClinicalObligation = {
 id:"SM-CLINICAL-OBLIGATION", authority:"ENG-308", initial:"OPEN",
 states:["OPEN","SCHEDULED","IN_PROGRESS","WAITING_EXTERNAL","OVERDUE","ESCALATED","COMPLETED","CANCELLED","FAILED"],
 terminal:["COMPLETED","CANCELLED"],
 transitions:[
  {from:"OPEN",event:"SCHEDULE",to:"SCHEDULED"},
  {from:"SCHEDULED",event:"START",to:"IN_PROGRESS"},
  {from:"IN_PROGRESS",event:"WAIT_EXTERNAL",to:"WAITING_EXTERNAL"},
  {from:"WAITING_EXTERNAL",event:"RESUME",to:"IN_PROGRESS"},
  {from:"OPEN",event:"OVERDUE",to:"OVERDUE"},
  {from:"SCHEDULED",event:"OVERDUE",to:"OVERDUE"},
  {from:"WAITING_EXTERNAL",event:"OVERDUE",to:"OVERDUE"},
  {from:"OVERDUE",event:"ESCALATE",to:"ESCALATED"},
  {from:"ESCALATED",event:"RESOLVE",to:"COMPLETED"},
  {from:"IN_PROGRESS",event:"COMPLETE",to:"COMPLETED"},
  {from:"OPEN",event:"CANCEL",to:"CANCELLED"},
  {from:"SCHEDULED",event:"CANCEL",to:"CANCELLED"}
 ],
 reconciliation:{owner:"clinical-obligation-service",detection:"due-date + orphan scan",
 recovery:"retry/reassign/escalate with explicit reason",evidence:"obligation-ledger+audit"}
} as const satisfies StateMachineDefinition<string,string>;
