export type Table=Readonly<{name:string;columns:ReadonlySet<string>}>;
export function validateSqlReferences(sql:string,tables:readonly Table[]){const errors:string[]=[];for(const m of sql.matchAll(/\b(?:insert\s+into|update|from|join)\s+([a-z_][a-z0-9_]*)/gi)){if(!tables.some(t=>t.name===m[1]))errors.push(`UNKNOWN_TABLE:${m[1]}`)}return errors}
export function duplicateColumns(cols:readonly string[]){return [...new Set(cols.filter((x,i)=>cols.indexOf(x)!==i))]}
