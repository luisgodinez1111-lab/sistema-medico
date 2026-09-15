import{validateTransactionPlan,type TransactionPlan}from"../../transaction-plan/src";
export type GoldenEncounterCommand=Readonly<{tenantId:string;patientId:string;encounterId:string;actorId:string;expectedVersion:number;assessment:string;plan:string}>;
export function buildEncounterPlan(c:GoldenEncounterCommand):TransactionPlan{if(!c.assessment||!c.plan)throw new Error("ASSESSMENT_AND_PLAN_REQUIRED");return validateTransactionPlan({tenantId:c.tenantId,aggregateId:c.encounterId,expectedVersion:c.expectedVersion,steps:[
{kind:"STATE",key:"encounter",payload:{patientId:c.patientId,status:"READY_TO_SIGN"}},
{kind:"EVENT",key:"EncounterAssessed",payload:{assessment:c.assessment,plan:c.plan}},
{kind:"OUTBOX",key:"encounter.assessed",payload:{patientId:c.patientId}},
{kind:"AUDIT",key:"clinical-write",payload:{actorId:c.actorId}}
]});}
