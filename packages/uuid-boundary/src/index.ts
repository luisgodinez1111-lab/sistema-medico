const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertUuid(x:string,label="id"){if(!UUID.test(x))throw new Error(`INVALID_UUID:${label}`);return x;}
