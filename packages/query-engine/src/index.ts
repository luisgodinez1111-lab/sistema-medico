
export type Page<T>=Readonly<{items:readonly T[];nextCursor?:string|undefined}>;
export function cursorPage<T>(items:readonly T[],limit:number,encode:(x:T)=>string):Page<T>{if(limit<1||limit>100)throw new Error("PAGE_LIMIT_INVALID");const slice=items.slice(0,limit);return {items:slice,nextCursor:items.length>limit&&slice.length?encode(slice[slice.length-1]!):undefined};}
