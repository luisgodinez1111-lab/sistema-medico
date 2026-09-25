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
// Auditoría 2026-09-19, anexo R01 (R01-003, R01-019) — RECURSO EXPLÍCITO y fin del chequeo tautológico.
//
// Las 97 llamadas pasaban `tenantId: claims.tenantId`, es decir comparaban el tenant del principal con el tenant del
// MISMO principal: un chequeo que no podía fallar y que daba una falsa sensación de control cross-tenant. El aislamiento
// real lo da RLS en la base (ADR-0250) y, cuando el handler ya leyó el recurso, la comparación explícita de su tenant.
//
// Ahora el llamador declara SOBRE QUÉ autoriza (`resource`). Eso sirve para tres cosas:
//   1. el chequeo cross-tenant es REAL cuando el recurso trae su tenant (leído de la base, no de los claims);
//   2. la política de acceso a pacientes vive en UN solo sitio (`patientAccessPolicy`), de modo que pasar de
//      «todo el tenant ve a todos» a «solo la relación asistencial» no toca 97 rutas (ADR-0230 lo deja como decisión
//      del dueño: hoy es TENANT_WIDE, con la auditoría de lecturas como control compensatorio — R01-026);
//   3. el error nombra el recurso, útil para el registro sin exponer PHI (tipo e identificador, nunca contenido).
export type AuthorizedResource=Readonly<{type:string;id:string;tenantId?:string;patientId?:string}>;
export type PatientAccessPolicy="TENANT_WIDE"|"CARE_RELATIONSHIP";
// Política vigente. Cambiarla exige implementar el registro de relación asistencial (decisión del dueño, ADR-0230).
export const patientAccessPolicy=():PatientAccessPolicy=>"TENANT_WIDE";
// Auditoría 2026-09-19, anexo R02b (R2B-025) — `purpose` ADMITE UN CONJUNTO, no solo un valor.
//
// El hallazgo: `handleOfficeSettingsGet`/`Update` no pasaban `purpose`, y como esta función solo lo compara «si viene»
// (`if(x.purpose&&...)`), la comprobación se omitía por completo: cualquier propósito en el token —RESEARCH, BILLING— servía
// para leer o cambiar la configuración del consultorio, mientras `docs/compliance/README.md` declara «authz por
// purpose-of-use» como control de LFPDPPP.
//
// Por qué un CONJUNTO y no un valor: hay operaciones legítimas bajo más de un propósito. Configurar el consultorio lo hace
// tanto el médico en su sesión clínica (TREATMENT, que es la única que este sistema emite hoy) como personal administrativo
// (OPERATIONS). Lo que NO puede es hacerse desde una sesión de investigación o de facturación. Con un solo valor admitido, la
// única forma de no romper el uso real era no pasar propósito —es decir, no comprobar nada—, que es exactamente el hallazgo.
export function authorize(p:Principal,x:{role?:string;scope:string;purpose?:string|readonly string[];resource?:AuthorizedResource;tenantId?:string}){
 if(!p.sessionId)throw new ClinicalError("UNAUTHENTICATED","Verified session required");
 if(!x.scope)throw new ClinicalError("INVARIANT_VIOLATION","authorize() requires a scope"); // fail-closed ante un llamador mal escrito
 // Chequeo cross-tenant REAL: solo cuando el tenant viene del RECURSO (o lo declara explícitamente el llamador),
 // nunca comparando los claims contra sí mismos.
 const resourceTenant=x.resource?.tenantId??x.tenantId;
 if(resourceTenant!==undefined&&resourceTenant!==p.tenantId)
  throw new ClinicalError("CROSS_TENANT","Cross-tenant access denied",{...(x.resource?{resourceType:x.resource.type}:{})});
 if(x.role&&!p.roles.includes(x.role))throw new ClinicalError("FORBIDDEN","Required role missing",{role:x.role});
 if(!hasScope(p.scopes,x.scope))throw new ClinicalError("FORBIDDEN","Required scope missing",{scope:x.scope});
 if(x.purpose!==undefined){
  const admitidos=typeof x.purpose==="string"?[x.purpose]:x.purpose;
  // Una lista vacía sería «ningún propósito admitido», que no es una política: es un llamador mal escrito. Fail-closed.
  if(admitidos.length===0)throw new ClinicalError("INVARIANT_VIOLATION","authorize() recibió una lista de propósitos vacía");
  if(!admitidos.includes(p.purpose))throw new ClinicalError("FORBIDDEN","Purpose mismatch",{purpose:p.purpose});
 }
 // Relación asistencial: con la política vigente no se exige (y así queda dicho en el código, no solo en un ADR).
 if(patientAccessPolicy()==="CARE_RELATIONSHIP"&&x.resource?.patientId&&!p.scopes.includes("patient:all"))
  throw new ClinicalError("FORBIDDEN","Care relationship required",{resourceType:x.resource.type});
 return true;
}
/**
 * Compara el tenant de un recurso YA LEÍDO con el del principal. Es el chequeo cross-tenant que de verdad puede fallar:
 * úsalo cuando el handler tenga en la mano el tenant del dato (por ejemplo tras leerlo con un rol sin RLS en un script).
 */
export function assertResourceInTenant(p:Principal,resource:AuthorizedResource):void{
 if(resource.tenantId!==undefined&&resource.tenantId!==p.tenantId)
  throw new ClinicalError("CROSS_TENANT","Cross-tenant access denied",{resourceType:resource.type});
}
