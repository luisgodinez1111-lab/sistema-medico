
export type VersionedEntity=Readonly<{id:string;tenantId:string;version:number}>;
export interface Repository<T extends VersionedEntity>{get(tenantId:string,id:string):Promise<T|null>;insert(entity:T):Promise<void>;update(entity:T,expectedVersion:number):Promise<void>;}
export class InMemoryRepository<T extends VersionedEntity> implements Repository<T>{
 private rows=new Map<string,T>();private k=(t:string,id:string)=>`${t}:${id}`;
 async get(t:string,id:string){return this.rows.get(this.k(t,id))??null;}
 async insert(e:T){const k=this.k(e.tenantId,e.id);if(this.rows.has(k))throw new Error("ENTITY_EXISTS");this.rows.set(k,e);}
 async update(e:T,expected:number){const k=this.k(e.tenantId,e.id),cur=this.rows.get(k);if(!cur)throw new Error("ENTITY_NOT_FOUND");if(cur.version!==expected)throw new Error(`OPTIMISTIC_CONCURRENCY:${expected}:${cur.version}`);this.rows.set(k,e);}
}