export type Temporal=Readonly<{occurredAt:number;recordedAt:number;effectiveFrom?:number;effectiveTo?:number}>;
export function temporalErrors(x:Temporal){const e:string[]=[];if(x.recordedAt<x.occurredAt)e.push("RECORDED_BEFORE_OCCURRED");if(x.effectiveFrom!==undefined&&x.effectiveTo!==undefined&&x.effectiveTo<=x.effectiveFrom)e.push("INVALID_EFFECTIVE_INTERVAL");return e}
