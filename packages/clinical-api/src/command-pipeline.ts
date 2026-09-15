
export type PipelineContext=Readonly<{commandId:string;correlationId:string;tenantId:string;actorId:string}>;
export async function executeClinicalCommand<T>(ctx:PipelineContext,deps:{idempotency:{execute(k:string,fn:()=>Promise<T>):Promise<T>|T};authorize:()=>void;audit:(event:string)=>Promise<void>;handle:()=>Promise<T>}){
 return deps.idempotency.execute(`${ctx.tenantId}:${ctx.commandId}`,async()=>{deps.authorize();await deps.audit("COMMAND_ACCEPTED");try{const r=await deps.handle();await deps.audit("COMMAND_SUCCEEDED");return r;}catch(e){await deps.audit("COMMAND_FAILED");throw e;}});
}