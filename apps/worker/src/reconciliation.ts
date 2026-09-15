
import {OutboxMessage} from "../../../packages/outbox/src";
export type ReconciliationFinding=Readonly<{kind:"DEAD_LETTER"|"STALE_RETRY";messageId:string;severity:"S1"|"S2";action:"ESCALATE"|"REQUEUE"}>;
export function reconcileOutbox(messages:readonly OutboxMessage[],now:string):ReconciliationFinding[]{return messages.flatMap(m=>m.state==="DEAD_LETTER"?[{kind:"DEAD_LETTER",messageId:m.id,severity:"S1",action:"ESCALATE"} as const]:m.state==="RETRY"&&m.nextAttemptAt&&Date.parse(m.nextAttemptAt)<Date.parse(now)?[{kind:"STALE_RETRY",messageId:m.id,severity:"S2",action:"REQUEUE"} as const]:[]);}
