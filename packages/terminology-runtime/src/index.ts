export type Coding=Readonly<{system:string;code:string;display?:string;version?:string}>;export function assertCoding(c:Coding){if(!c.system||!c.code)throw new Error('CODING_REQUIRED');return c;}
