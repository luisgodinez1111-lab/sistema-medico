import{ClinicalError}from"../../runtime-errors/src";
export type Principal=Readonly<{tenantId:string;actorId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}>;
// Auditoría 2026-09-19 (S-01, S-02) — MODELO DE SCOPES.
//
// Antes `scope` era opcional (una llamada sin scope autorizaba a cualquiera del tenant) y 13 de 26 lecturas exigían el scope
// de ESCRITURA: era imposible un rol de solo lectura. Ahora:
//   · `scope` es OBLIGATORIO: no existe autorización "solo por tenant".
//   · Cada recurso tiene `<recurso>:read` y `<recurso>:write` (y `medication:propose`). Un scope de escritura IMPLICA el de
//     lectura del mismo recurso: quien puede escribir órdenes puede leerlas; lo inverso nunca. Así las sesiones ya emitidas
//     (roles con scopes de escritura) siguen funcionando y un rol de solo lectura (auditoría, consulta externa) es posible.
//   · La implicación vive AQUÍ, en un solo sitio; las rutas piden el scope mínimo que necesitan (lecturas → `:read`).
//
// Lo que este modelo NO decide (ver ADR-0230): la relación médico–paciente dentro del tenant. Un tenant es un consultorio o
// clínica; todo clínico del tenant con el scope ve a todos sus pacientes, con auditoría de cada acceso.
const IMPLIES:Readonly<Record<string,readonly string[]>>={write:["read"],propose:["read"]};
export function hasScope(scopes:readonly string[],required:string):boolean{
 if(scopes.includes(required))return true;
 const i=required.lastIndexOf(":");if(i<=0)return false;
 const resource=required.slice(0,i),action=required.slice(i+1);
 return scopes.some(s=>{const j=s.lastIndexOf(":");return j>0&&s.slice(0,j)===resource&&(IMPLIES[s.slice(j+1)]??[]).includes(action);});
}
// Scopes efectivos de una sesión (los declarados más los implicados). Útil para mostrar permisos, no para autorizar.
export function effectiveScopes(scopes:readonly string[]):string[]{
 const out=new Set(scopes);
 for(const s of scopes){const j=s.lastIndexOf(":");if(j>0)for(const a of IMPLIES[s.slice(j+1)]??[])out.add(`${s.slice(0,j)}:${a}`);}
 return[...out].sort();
}
export function authorize(p:Principal,x:{tenantId:string;role?:string;scope:string;purpose?:string}){
 if(!p.sessionId)throw new ClinicalError("UNAUTHENTICATED","Verified session required");
 if(p.tenantId!==x.tenantId)throw new ClinicalError("CROSS_TENANT","Cross-tenant access denied");
 if(!x.scope)throw new ClinicalError("INVARIANT_VIOLATION","authorize() requires a scope"); // fail-closed ante un llamador mal escrito
 if(x.role&&!p.roles.includes(x.role))throw new ClinicalError("FORBIDDEN","Required role missing",{role:x.role});
 if(!hasScope(p.scopes,x.scope))throw new ClinicalError("FORBIDDEN","Required scope missing",{scope:x.scope});
 if(x.purpose&&p.purpose!==x.purpose)throw new ClinicalError("FORBIDDEN","Purpose mismatch");
 return true;
}
