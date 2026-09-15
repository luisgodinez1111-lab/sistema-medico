export type Edge=Readonly<{from:string;to:string;kind:"DERIVED_FROM"|"DISPLAYED_AS"|"ACTIONED_ON"}>;
export function descendants(xs:readonly Edge[],root:string){const out=new Set<string>(),q=[root];while(q.length){const n=q.shift()!;for(const e of xs.filter(x=>x.from===n))if(!out.has(e.to)){out.add(e.to);q.push(e.to)}}return[...out]}
