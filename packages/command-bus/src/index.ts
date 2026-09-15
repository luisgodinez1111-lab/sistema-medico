export type Command=Readonly<{id:string;tenantId:string;actorId:string;type:string;aggregateId:string;expectedVersion:number;payload:unknown}>;
export type CommandHandler=Readonly<{type:string;handle:(c:Command)=>readonly unknown[]}>;
export class CommandBus{private h=new Map<string,CommandHandler>();register(x:CommandHandler){if(this.h.has(x.type))throw new Error("DUPLICATE_COMMAND_HANDLER");this.h.set(x.type,x);}dispatch(c:Command){const h=this.h.get(c.type);if(!h)throw new Error(`COMMAND_HANDLER_MISSING:${c.type}`);return h.handle(c);}}
