import{ClinicalError}from"../../runtime-errors/src";
export type Versioned<T>=Readonly<{id:string;tenantId:string;version:number;state:T}>;
export class MemoryClinicalRepository<T>{
 private readonly rows=new Map<string,Versioned<T>>();
 get(id:string){return this.rows.get(id);}
 save(next:Versioned<T>,expectedVersion:number){
  const current=this.rows.get(next.id);const actual=current?.version??0;
  if(actual!==expectedVersion)throw new ClinicalError("CONCURRENCY_CONFLICT","Optimistic concurrency conflict",{expectedVersion,actual});
  if(next.version!==expectedVersion+1)throw new ClinicalError("INVARIANT_VIOLATION","Version must advance exactly once");
  this.rows.set(next.id,Object.freeze(next));return next;
 }
}
