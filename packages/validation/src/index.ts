
export function requireUuidLike(v:unknown,name:string){if(typeof v!=="string"||!/^[0-9a-f-]{8,}$/i.test(v))throw new Error(`VALIDATION:${name}`);return v;}
export function requireNonEmpty(v:unknown,name:string){if(typeof v!=="string"||!v.trim())throw new Error(`VALIDATION:${name}`);return v.trim();}
