
export class IdempotencyStore<T>{
 private values=new Map<string,T>();
 execute(key:string,fn:()=>T):T{if(this.values.has(key))return this.values.get(key)!;const v=fn();this.values.set(key,v);return v;}
}
