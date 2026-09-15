export type RecoveryAction=Readonly<{obligationId:string;ownerId:string;action:"REASSIGN"|"ESCALATE"|"RESCHEDULE";reason:string}>;
export function recover(x:RecoveryAction){if(!x.ownerId||!x.reason)throw new Error("RECOVERY_ACCOUNTABILITY_REQUIRED");return{...x,recorded:true};}
