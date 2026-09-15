import { StateMachineDefinition } from "./state-machine";

export const ResultLifecycle = {
 id:"SM-RESULT-LIFECYCLE", authority:"ENG-307",
 initial:"EXPECTED",
 states:["EXPECTED","ORDERED","RECEIVED","VERIFIED","REVIEWED","ACTION_REQUIRED","ACTIONED","PATIENT_INFORMED","CLOSED","CORRECTED","CANCELLED","UNMATCHED","FAILED","OVERDUE","ESCALATED"],
 terminal:["CLOSED","CANCELLED"],
 transitions:[
  {from:"EXPECTED",event:"ORDER",to:"ORDERED"},
  {from:"ORDERED",event:"RECEIVE",to:"RECEIVED"},
  {from:"RECEIVED",event:"VERIFY",to:"VERIFIED"},
  {from:"VERIFIED",event:"REVIEW",to:"REVIEWED"},
  {from:"REVIEWED",event:"REQUIRE_ACTION",to:"ACTION_REQUIRED"},
  {from:"REVIEWED",event:"CLOSE_NO_ACTION",to:"CLOSED"},
  {from:"ACTION_REQUIRED",event:"ACTION",to:"ACTIONED"},
  {from:"ACTIONED",event:"INFORM_PATIENT",to:"PATIENT_INFORMED"},
  {from:"PATIENT_INFORMED",event:"CLOSE",to:"CLOSED"},
  {from:"RECEIVED",event:"CORRECT",to:"CORRECTED"},
  {from:"ORDERED",event:"CANCEL",to:"CANCELLED"},
  {from:"ORDERED",event:"OVERDUE",to:"OVERDUE"},
  {from:"OVERDUE",event:"ESCALATE",to:"ESCALATED"}
 ],
 reconciliation:{owner:"results-service",detection:"orphan/overdue scan",recovery:"re-link/requeue/escalate",evidence:"audit+provenance"}
} as const satisfies StateMachineDefinition<string,string>;

export const MedicationLifecycle = {
 id:"SM-MEDICATION-LIFECYCLE", authority:"ENG-220", initial:"PROPOSED",
 states:["PROPOSED","PRESCRIBED","STARTED","ACTIVE","MODIFIED","HELD","STOPPED","CANCELLED"],
 terminal:["STOPPED","CANCELLED"],
 transitions:[
  {from:"PROPOSED",event:"PRESCRIBE",to:"PRESCRIBED"},
  {from:"PRESCRIBED",event:"START",to:"STARTED"},
  {from:"STARTED",event:"ACTIVATE",to:"ACTIVE"},
  {from:"ACTIVE",event:"MODIFY",to:"MODIFIED"},
  {from:"MODIFIED",event:"ACTIVATE",to:"ACTIVE"},
  {from:"ACTIVE",event:"HOLD",to:"HELD"},
  {from:"HELD",event:"RESUME",to:"ACTIVE"},
  {from:"ACTIVE",event:"STOP",to:"STOPPED"},
  {from:"PROPOSED",event:"CANCEL",to:"CANCELLED"},
  {from:"PRESCRIBED",event:"CANCEL",to:"CANCELLED"}
 ]
} as const satisfies StateMachineDefinition<string,string>;
