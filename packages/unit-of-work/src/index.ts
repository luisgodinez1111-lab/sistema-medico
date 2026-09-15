
export interface Transaction{commit():Promise<void>;rollback():Promise<void>}
export async function withTransaction<T>(begin:()=>Promise<Transaction>,fn:(tx:Transaction)=>Promise<T>):Promise<T>{const tx=await begin();try{const r=await fn(tx);await tx.commit();return r;}catch(e){await tx.rollback();throw e;}}
