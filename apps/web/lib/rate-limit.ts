import{consume,type Bucket}from"../../../packages/rate-limit-v2/src";
// Auditoría 2026-09-19 (S-03) — LÍMITE DE TASA. `packages/rate-limit(-v2)` existía con tests pero ningún archivo de `apps/`
// lo importaba: ni el login ni las escrituras tenían límite. Este módulo es la única pieza que lo aplica y NO importa nada
// de Node: lo usan el middleware (borde) y el handler de login (Node).
//
// Alcance honesto: el estado vive en memoria de la instancia. En Vercel (Fluid Compute) una instancia atiende muchas
// peticiones seguidas, así que el límite es real, pero con N instancias el tope efectivo es ~N veces el declarado. Un
// atacante distribuido sigue viendo un techo por instancia, no infinito como antes. El siguiente paso (registrado en el
// tracker) es un almacén compartido; la interfaz `allow(key)` no cambiaría.
export type LimitPolicy=Readonly<{capacity:number;refillPerSecond:number;maxKeys:number}>;
export type LimitDecision=Readonly<{allowed:boolean;retryAfterSeconds:number;remaining:number}>;
// Login: 10 intentos de golpe por IP y luego uno cada 6 s. Un humano que se equivoca no lo nota; un diccionario de tokens sí.
export const LOGIN_POLICY:LimitPolicy={capacity:10,refillPerSecond:10/60,maxKeys:10_000};
// Escrituras clínicas: 120 de golpe y 2/s sostenidas por SESIÓN (no por IP: una clínica entera comparte IP). Muy por encima
// del ritmo de un médico; muy por debajo de un script.
export const WRITE_POLICY:LimitPolicy={capacity:120,refillPerSecond:2,maxKeys:50_000};

export class KeyedRateLimiter{
 private readonly buckets=new Map<string,Bucket>();
 constructor(private readonly policy:LimitPolicy){}
 allow(key:string,now=Date.now()):LimitDecision{
  const prev=this.buckets.get(key)??{tokens:this.policy.capacity,capacity:this.policy.capacity,refillPerSecond:this.policy.refillPerSecond,lastMs:now};
  const r=consume(prev,now);
  // Map conserva el orden de inserción: borrar y reinsertar mantiene al final las llaves recientes (LRU barato). Llenos,
  // se expulsa la más antigua: un atacante puede "empujar" llaves ajenas, pero eso solo le devuelve el estado inicial
  // (capacidad completa), nunca más de lo que la política concede.
  this.buckets.delete(key);
  if(this.buckets.size>=this.policy.maxKeys){const oldest=this.buckets.keys().next().value;if(oldest!==undefined)this.buckets.delete(oldest);}
  this.buckets.set(key,r.bucket);
  const retryAfterSeconds=r.allowed?0:Math.max(1,Math.ceil((1-r.bucket.tokens)/this.policy.refillPerSecond));
  return{allowed:r.allowed,retryAfterSeconds,remaining:Math.floor(r.bucket.tokens)};
 }
 /** Solo para pruebas. */
 reset(){this.buckets.clear();}
 get size(){return this.buckets.size;}
}
// IP del cliente. En Vercel `x-forwarded-for` lo sobreescribe la plataforma con la IP real (no lo controla el cliente);
// fuera de Vercel su primer valor es lo mejor disponible. Sin cabeceras: una sola llave compartida (fail-closed: se limita).
export function clientIp(headers:Headers):string{
 const xff=headers.get("x-forwarded-for");
 const first=xff?.split(",")[0]?.trim();
 return first||headers.get("x-real-ip")?.trim()||"unknown";
}
// Llave de una escritura: la sesión si la hay (cola de la cookie firmada: única por sesión, no reversible a PHI), si no la IP.
export function writeKey(headers:Headers,cookieValue:string|undefined):string{
 return cookieValue&&cookieValue.length>=32?`s:${cookieValue.slice(-32)}`:`ip:${clientIp(headers)}`;
}
export const MUTATING_METHODS:ReadonlySet<string>=new Set(["POST","PUT","PATCH","DELETE"]);
// Cuerpo y cabeceras de un 429: misma forma de error que el resto de la API.
export function rateLimitedResponse(d:LimitDecision):Response{
 return new Response(JSON.stringify({error:{code:"RATE_LIMITED",message:`Demasiadas solicitudes. Reintente en ${d.retryAfterSeconds} s.`}}),
  {status:429,headers:{"content-type":"application/json","retry-after":String(d.retryAfterSeconds),"cache-control":"no-store"}});
}
// Limitadores compartidos por el proceso (uno por política).
export const loginLimiter=new KeyedRateLimiter(LOGIN_POLICY);
export const writeLimiter=new KeyedRateLimiter(WRITE_POLICY);
