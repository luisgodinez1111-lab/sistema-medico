export type DataClass="PUBLIC"|"INTERNAL"|"PHI"|"SECRET";
export function canLog(c:DataClass){return c==="PUBLIC"||c==="INTERNAL";}
export function requireEncryption(c:DataClass){return c==="PHI"||c==="SECRET";}
