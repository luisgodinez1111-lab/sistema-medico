// Auditoría 2026-09-19 (L-05): desde el lote 9b, PRESCRIBE y la firma (encuentro y documento) exigen la cédula profesional
// registrada en el perfil del médico (428 PHYSICIAN_CREDENTIALS_REQUIRED si falta). Las pruebas en vivo registran una
// identidad profesional SINTÉTICA para su token de médico antes de prescribir o firmar. El registro exige `settings:write`;
// si el token de la prueba no lo trae, se firma aquí un token equivalente (mismo sub, tenant y ROLES) solo para este paso.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts";
const{verifySession,signSession}=await import("../../packages/session/src");
const cred=await import("../../apps/web/app/api/v1/physician-profile/credentials/route");
export async function registerPhysicianCredentials(token:string,over:Partial<{fullName:string;cedulaProfesional:string;institution:string;specialty:string}>={}):Promise<void>{
 const secret=SIGNING_SECRET; // garantizado `string` por _live-env.mts, que lo genera si el entorno no lo trae
 const c=verifySession(token,secret);
 const t=c.scopes.includes("settings:write")?token:signSession({...c,scopes:[...c.scopes,"settings:write"]},secret);
 const r=await cred.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+t,"idempotency-key":crypto.randomUUID()},
  body:JSON.stringify({fullName:"Dra. Prueba En Vivo",cedulaProfesional:"1234567",institution:"UNAM — Facultad de Medicina",...over})}));
 if(r.status!==201&&r.status!==200)throw new Error("PHYSICIAN_CREDENTIALS_FAILED:"+r.status+":"+await r.text());
}
