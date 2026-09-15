import type{TransactionPlan}from"../../transaction-plan/src";
export interface ClinicalTx{query:(sql:string,params?:readonly unknown[])=>Promise<any[]>}
export async function executePlan(tx:ClinicalTx,p:TransactionPlan){const out:any[]=[];for(const s of p.steps)out.push({key:s.key,result:await tx.query("select $1::text as step",[s.kind])});return{aggregateId:p.aggregateId,expectedVersion:p.expectedVersion,steps:out.length};}
