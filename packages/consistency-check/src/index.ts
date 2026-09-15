export type Drift=Readonly<{kind:"STATE_EVENT_DRIFT"|"PROJECTION_DRIFT"|"OUTBOX_ORPHAN";severity:"S1"|"S2";id:string}>;
export function consistencyGate(xs:readonly Drift[]){return xs.some(x=>x.severity==="S1")?{status:"BLOCK",critical:xs.filter(x=>x.severity==="S1").length}:{status:"PASS",critical:0};}
