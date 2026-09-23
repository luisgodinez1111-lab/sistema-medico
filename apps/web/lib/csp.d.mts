type Env=Readonly<Record<string,string|undefined>>;
export function auth0Origin(env?:Env):string;
export function contentSecurityPolicy(env?:Env,nonce?:string):string;
