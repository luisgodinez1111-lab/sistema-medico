export type CacheDecision="NO_STORE"|"PRIVATE_SHORT"|"SAFE_REFERENCE";
export function clinicalCachePolicy(x:{containsPhi:boolean;clinicallyMutable:boolean;referenceData:boolean}):CacheDecision{if(x.containsPhi||x.clinicallyMutable)return"NO_STORE";if(x.referenceData)return"SAFE_REFERENCE";return"PRIVATE_SHORT";}
