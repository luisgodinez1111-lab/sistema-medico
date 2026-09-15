export function assertPagination(limit:number,offset:number){if(!Number.isInteger(limit)||limit<1||limit>200)throw new Error("INVALID_LIMIT");if(!Number.isInteger(offset)||offset<0||offset>1_000_000)throw new Error("INVALID_OFFSET");return{limit,offset}}
export function assertIdentifierLength(x:string){if(x.length<1||x.length>256)throw new Error("INVALID_IDENTIFIER_LENGTH");return x}
