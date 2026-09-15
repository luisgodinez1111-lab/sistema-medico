import postgres,{type Sql,type TransactionSql}from"postgres";
import{ClinicalError}from"../../runtime-errors/src";
export type DbContext=Readonly<{tenantId:string;actorId:string;purpose:string;requestId:string}>;
export class PostgresDatabase{
 readonly sql:Sql;
 constructor(url:string){this.sql=postgres(url,{max:20,idle_timeout:20,connect_timeout:10,prepare:true});}
 async close(){await this.sql.end({timeout:5});}
 async transaction<T>(ctx:DbContext,fn:(sql:TransactionSql)=>Promise<T>):Promise<T>{
  return this.sql.begin(async sql=>{
   await sql`select set_config('app.tenant_id',${ctx.tenantId},true)`;
   await sql`select set_config('app.actor_id',${ctx.actorId},true)`;
   await sql`select set_config('app.purpose',${ctx.purpose},true)`;
   await sql`select set_config('app.request_id',${ctx.requestId},true)`;
   const rows=await sql`select current_setting('app.tenant_id',true) tenant_id`;
   if(rows[0]?.tenant_id!==ctx.tenantId)throw new ClinicalError("SAFETY_BLOCKED","Database tenant context failed");
   return fn(sql);
  }) as Promise<T>;
 }
}
