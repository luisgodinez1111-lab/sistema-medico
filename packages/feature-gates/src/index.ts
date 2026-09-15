
export type GateState="DISABLED"|"SHADOW"|"CANARY"|"ENABLED";
export type SafetyGate=Readonly<{capability:string;state:GateState;allowedTenants?:readonly string[];evidenceBundle?:string}>;
export function assertCapabilityEnabled(g:SafetyGate,tenantId:string){
 if(g.state!=="ENABLED") throw new Error(`CAPABILITY_NOT_RELEASED:${g.capability}:${g.state}`);
 if(g.allowedTenants&&!g.allowedTenants.includes(tenantId)) throw new Error(`CAPABILITY_TENANT_BLOCKED:${g.capability}`);
 if(!g.evidenceBundle) throw new Error(`CAPABILITY_EVIDENCE_REQUIRED:${g.capability}`); return true;
}
