// Auditoría 2026-09-19, anexo R11 (R11-06) — EL ANDAMIAJE DE LAS PRUEBAS EN VIVO, UNA SOLA VEZ.
//
// EL HALLAZGO: «hay módulos compartidos (`_live-env`, `_patient`, `_physician-credentials`), pero el cuerpo de los proofs
// sigue siendo plantilla repetida». La réplica anterior en el cruce decía que el cuerpo es específico de cada dominio —los
// estados de una transfusión no se parecen a los de una factura— y que extraerlo haría la prueba menos legible. **Esa
// réplica es correcta a medias, y la mitad que falta es la que importa: confunde el CUERPO con el ANDAMIAJE.**
//
// MEDIDO sobre las 122 pruebas antes de escribir este módulo:
//   · 122/122 declaran el libro de resultados `{status,checks,error?}`;
//   · 114/122 llevan `function ok(c,l){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}` **byte a byte idéntica**;
//   · 122/122 terminan en `console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);`
//   · 108 acuñan su token con la MISMA forma (103 de ellas idéntica salvo los scopes);
//   · 101 declaran `idem()` y 39 el reloj monótono.
//
// Nada de eso es específico del dominio: es el CONTRATO con `scripts/ci/live-smoke.mts` —qué JSON se imprime y con qué
// código se sale— copiado 122 veces. Y ahí está el riesgo que la réplica no vio: **un contrato con 122 copias puede
// desviarse en cualquiera de ellas sin que nada lo note.** Hoy las 122 coinciden (se comprobó una por una); el día que una
// olvide el `process.exit` o imprima solo en el camino del fallo, esa prueba dejará de contar o reportará PASS sin haber
// comprobado nada, y el humo seguirá diciendo «122 PASS». Una evidencia que puede mentir en silencio no es evidencia.
//
// QUÉ SE EXTRAE Y QUÉ NO. Se extrae el andamiaje: el libro, `ok`, el acuñador de tokens, las cabeceras, la clave de
// idempotencia, el reloj y el protocolo de salida. **No se extrae una sola aserción clínica**: el cuerpo de cada prueba
// sigue siendo suyo, legible de arriba abajo, y por eso el resultado es MÁS legible que antes —el fichero queda siendo su
// dominio y nada más—, que es lo contrario de lo que la réplica temía.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts";
// `_live-env.mts` se importa AQUÍ, y eso basta: impone la base desechable y se niega a correr contra la de la aplicación
// antes de que cualquier módulo de la app se cargue, porque los proofs los cargan con `await import(...)` DESPUÉS de los
// imports estáticos. Una prueba que importe este módulo ya tiene el prólogo aplicado y no necesita importarlo aparte.
export{SIGNING_SECRET};

const{signSession}=await import("../../packages/session/src");
/** Propósitos admitidos por la sesión. Es un vocabulario CERRADO del dominio: aceptar `string` dejaría que una prueba
 *  acuñara un token con un propósito que el servidor rechaza, y el fallo se leería como un defecto del servidor. */
export type Proposito="TREATMENT"|"OPERATIONS"|"BILLING"|"RESEARCH";

/** Reloj de la corrida, en segundos. Se fija una vez para que `iat`/`exp` sean coherentes en toda la prueba. */
export const AHORA=Math.floor(Date.now()/1000);

/**
 * Acuña un token de sesión firmado. Cubre las 103 pruebas que lo acuñaban idéntico salvo los scopes, y deja override
 * explícito de `iat`/`exp` para las cinco que prueban CADUCIDAD —ésas necesitan un token vencido y el valor forma parte
 * de lo que miden, así que no puede venir de un valor por omisión escondido.
 */
export function token(o:{
 tenantId:string;scopes:readonly string[];
 sub?:string;roles?:readonly string[];purpose?:Proposito;
 iat?:number;exp?:number;sessionId?:string;
}):string{
 return signSession({
  sub:o.sub??crypto.randomUUID(),
  tenantId:o.tenantId,
  roles:o.roles??["PHYSICIAN"],
  scopes:o.scopes,
  purpose:o.purpose??"TREATMENT",
  iat:o.iat??AHORA-10,
  exp:o.exp??AHORA+3600,
  sessionId:o.sessionId??crypto.randomUUID(),
 },SIGNING_SECRET);
}

/** Cabeceras de una petición JSON autenticada. `extra` añade `idempotency-key`, `if-match`, etc. */
export const H=(t:string,extra:Record<string,string>={}):Record<string,string>=>
 ({"content-type":"application/json",authorization:"Bearer "+t,...extra});

/** Clave de idempotencia nueva. Una por comando: reutilizarla es lo que el kernel trata como reintento. */
export const idem=():string=>crypto.randomUUID();

/**
 * Reloj MONÓTONO de la prueba: cada llamada avanza un minuto desde `desde`.
 *
 * Las fechas de los eventos clínicos salen de aquí y no de `Date.now()` a propósito: un `occurredAt` derivado del reloj
 * real haría que dos eventos de la misma prueba cayeran en el mismo milisegundo y el orden quedaría indefinido, que es
 * justo lo que varias de estas pruebas miden.
 */
export function reloj(desde="2026-09-14T09:00:00.000Z",pasoMs=60000):()=>string{
 let t=Date.parse(desde);
 if(!Number.isFinite(t))throw new Error("RELOJ_DESDE_INVALIDO: "+desde);
 return()=>new Date(t+=pasoMs).toISOString();
}

export type Veredicto={status:string;checks:string[];error?:string};

/**
 * El libro de resultados y el PROTOCOLO DE SALIDA, en un solo sitio.
 *
 * `ok(cond,etiqueta)` apunta la comprobación o lanza. `fin(e?)` imprime el JSON que lee `live-smoke.mts` y sale con el
 * código que ese lector espera: **0 = PASS, 1 = FAIL**. El prólogo (`_live-env.mts`) usa el 3 para NOT_RUN y el 2 para
 * REFUSED antes de llegar aquí.
 *
 * `fin` es idempotente: llamarlo dos veces (en el `catch` y después) no imprime dos veces. Importa porque el patrón
 * natural al migrar es `try{...}catch(e){fin(e);} fin();`, y un JSON duplicado rompería al lector del humo.
 *
 * `X` declara los campos EXTRA que una prueba adjunta al veredicto —`detail`, `target`, `proof`: evidencia estructurada
 * de lo que midió—. Se declaran por prueba (`libro<{detail:unknown}>()`) en lugar de ensanchar `Veredicto` para todas:
 * un veredicto con claves libres dejaría de ser un contrato.
 */
export function libro<X extends Record<string,unknown>=Record<never,never>>():{result:Veredicto&Partial<X>;ok:(c:boolean,l:string)=>void;fin:(e?:unknown)=>never} {
 const result={status:"PASS",checks:[] as string[]} as Veredicto&Partial<X>;
 let cerrado=false;
 const ok=(c:boolean,l:string):void=>{if(!c)throw new Error("FAIL:"+l);result.checks.push(l);};
 const fin=(e?:unknown):never=>{
  if(e!==undefined&&result.status==="PASS"){result.status="FAIL";result.error=e instanceof Error?e.message:String(e);}
  if(!cerrado){cerrado=true;console.log(JSON.stringify(result,null,2));}
  process.exit(result.status==="PASS"?0:1);
 };
 return{result,ok,fin};
}
