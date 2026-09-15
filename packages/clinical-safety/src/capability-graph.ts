
export type CapabilityNode=Readonly<{id:string;dependsOn:readonly string[];risk:"C2"|"C3"|"C4"|"C5"}>;
export function blastRadius(nodes:readonly CapabilityNode[],failed:string){
 const affected=new Set([failed]);let changed=true;
 while(changed){changed=false;for(const n of nodes)if(n.dependsOn.some(d=>affected.has(d))&&!affected.has(n.id)){affected.add(n.id);changed=true;}}
 return [...affected];
}
export function assertAcyclic(nodes:readonly CapabilityNode[]){
 const m=new Map(nodes.map(n=>[n.id,n.dependsOn]));const visiting=new Set<string>(),done=new Set<string>();
 const visit=(x:string)=>{if(visiting.has(x))throw new Error(`CAPABILITY_CYCLE:${x}`);if(done.has(x))return;visiting.add(x);for(const d of m.get(x)??[])visit(d);visiting.delete(x);done.add(x);};
 for(const n of nodes)visit(n.id);return true;
}
