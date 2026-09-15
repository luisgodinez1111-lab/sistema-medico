export type TxContext=Readonly<{tenantId:string;actorId:string;purpose:string;requestId:string}>;
export type AtomicClinicalBundle=Readonly<{stateMutation:boolean;events:number;audit:number;outbox:number;idempotencyCompletion:boolean}>;
export function admitAtomicBundle(b:AtomicClinicalBundle){if(b.stateMutation&&(b.events<1||b.audit<1||b.outbox<1||!b.idempotencyCompletion))throw new Error('ATOMIC_BUNDLE_INCOMPLETE');return true;}
