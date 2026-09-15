export type DbSessionContext=Readonly<{tenantId:string;actorId:string;purpose:string}>;
export function sessionStatements(x:DbSessionContext){if(!x.tenantId||!x.actorId||!x.purpose)throw new Error("DB_SESSION_CONTEXT_REQUIRED");return[
{sql:"select set_config('app.tenant_id',$1,true)",params:[x.tenantId]},
{sql:"select set_config('app.actor_id',$1,true)",params:[x.actorId]},
{sql:"select set_config('app.purpose',$1,true)",params:[x.purpose]}
];}
