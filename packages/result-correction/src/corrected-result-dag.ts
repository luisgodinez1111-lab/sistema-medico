
export type ResultNode={id:string; version:number; supersedes?:string; hash:string; receivedAt:string};
export class CorrectedResultDag{
 private nodes=new Map<string,ResultNode>();
 add(node:ResultNode){
  if(this.nodes.has(node.id)) throw new Error(`DUPLICATE_RESULT:${node.id}`);
  if(node.supersedes && !this.nodes.has(node.supersedes)) throw new Error(`UNKNOWN_SUPERSEDED_RESULT:${node.supersedes}`);
  if(node.supersedes){
   const prev=this.nodes.get(node.supersedes)!;
   if(node.version<=prev.version) throw new Error(`NON_MONOTONIC_RESULT_VERSION:${node.id}`);
  }
  this.nodes.set(node.id,Object.freeze({...node}));
 }
 lineage(id:string):ResultNode[]{
  const out:ResultNode[]=[]; let cur=this.nodes.get(id);
  while(cur){out.push(cur); cur=cur.supersedes?this.nodes.get(cur.supersedes):undefined;}
  return out;
 }
 snapshot(){return [...this.nodes.values()].map(x=>({...x}));}
}
