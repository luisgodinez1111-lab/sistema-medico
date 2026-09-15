
export type RuntimeConfig=Readonly<{environment:"development"|"test"|"production";databaseUrl:string;appOrigin:string;logLevel:"debug"|"info"|"warn"|"error";releaseId:string}>;
export function loadConfig(env:Record<string,string|undefined>=process.env):RuntimeConfig{
 const required=(k:string)=>{const v=env[k];if(!v)throw new Error(`CONFIG_REQUIRED:${k}`);return v};
 const environment=(env.NODE_ENV??"development") as RuntimeConfig["environment"];
 if(!["development","test","production"].includes(environment))throw new Error("CONFIG_INVALID:NODE_ENV");
 return Object.freeze({environment,databaseUrl:required("DATABASE_URL"),appOrigin:required("APP_ORIGIN"),logLevel:(env.LOG_LEVEL??"info") as RuntimeConfig["logLevel"],releaseId:required("RELEASE_ID")});
}