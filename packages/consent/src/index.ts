export type Consent=Readonly<{patientId:string;scope:string;status:"GRANTED"|"REVOKED";effectiveAt:string;expiresAt?:string}>;
export function assertConsent(c:Consent|undefined,scope:string,at:string){if(!c||c.scope!==scope||c.status!=="GRANTED")throw new Error("CONSENT_REQUIRED");if(c.expiresAt&&Date.parse(at)>Date.parse(c.expiresAt))throw new Error("CONSENT_EXPIRED");return true;}
