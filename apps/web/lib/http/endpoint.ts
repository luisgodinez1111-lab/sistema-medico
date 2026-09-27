import{NextResponse}from"next/server";
import{authorize}from"../../../../packages/runtime-auth/src";
import{type ResolvedPrincipal}from"../../../../packages/http-principal/src";
import{ClinicalError}from"../../../../packages/runtime-errors/src";
import{toHttpError}from"../http-errors";
import{isAggregateId}from"../runtime/ids";
import{principalFrom,resolveVerified}from"../http-command";
// Lote 11 (ADR-0300) — KIT DE TRANSPORTE HTTP. Antes, cada handler de apps/web copiaba su propio preludio (sesión verificada
// → autorización) y su propio `catch` (~210 copias de `toHttpError → NextResponse.json`). Aquí vive la única copia de ambos:
// cambiar la traducción de errores, la validación de parámetros o el id de correlación se hace en un sitio.
export type Guard=Readonly<{scope:string;role?:string;purpose?:string}>;
export type Verified=ResolvedPrincipal;
// Fallo de dominio → respuesta HTTP fail-closed y sin PHI (apps/web/lib/http-errors.ts decide el estado y los detalles).
export function errorResponse(e:unknown):Response{const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
// Preludio común: sesión verificada (401), autorización por scope/rol/propósito (403), y el caso de uso dentro del mismo `try`
// (el `await` es necesario: sin él un rechazo escaparía al manejador de Next como 500 HTML). La guarda nunca sustituye el
// tenant de la sesión: se aplica ANTES que `tenantId`.
export async function endpoint(req:Request,guard:Guard,fn:(v:Verified)=>Promise<Response>):Promise<Response>{
 try{const v=resolveVerified(req);authorize(principalFrom(v.claims),{...guard,tenantId:v.claims.tenantId});return await fn(v);}
 catch(e){return errorResponse(e);}
}
// Hallazgo D8 del lote 11 — parámetros de ruta `*Id`: tras autenticar y autorizar, un id que no es UUID es 404 explícito y la
// operación no llega a la persistencia. Se llama con TODOS los ids de la ruta (p. ej. {patientId}, {documentId,attachmentId}).
export function assertRouteIds(ids:Readonly<Record<string,string>>):void{
 for(const[name,value]of Object.entries(ids))if(!isAggregateId(value))throw new ClinicalError("NOT_FOUND",`Resource not found (${name})`);
}
