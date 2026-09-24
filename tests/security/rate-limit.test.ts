import {describe,it,expect} from "vitest";
import {consume,type Bucket} from "../../packages/rate-limit-v2/src";
// Auditoría 2026-09-19, anexo R01 (R01-033): este test ejercitaba `packages/rate-limit` (v1), un paquete que NINGÚN
// camino de producción importaba —el limitador real es `rate-limit-v2` vía `apps/web/lib/rate-limit.ts` y el almacén
// compartido `rate_limit_buckets` (migración 0021)—. Un test verde sobre código muerto es peor que no tenerlo: da
// cobertura aparente. Ahora prueba el bucket que de verdad decide, y v1 se retiró del repo.
const bucket=(over:Partial<Bucket>={}):Bucket=>({tokens:1,capacity:1,refillPerSecond:0,lastMs:0,...over});

describe("límite de tasa: bucket de tokens que aplica la aplicación",()=>{
 it("acota la ráfaga: sin recarga, el segundo intento se niega",()=>{
  const primero=consume(bucket(),0);
  expect(primero.allowed).toBe(true);
  expect(consume(primero.bucket,0).allowed).toBe(false);
 });
 it("recarga con el tiempo hasta la capacidad, nunca por encima",()=>{
  const gastado=consume(bucket({capacity:2,tokens:2,refillPerSecond:1}),0).bucket;
  expect(consume(gastado,10_000).allowed).toBe(true);                 // 10 s de recarga
  expect(consume({...gastado,lastMs:0},10_000).bucket.tokens).toBeLessThanOrEqual(2);
 });
 it("no permite saldo negativo ni «tokens prestados» con un coste mayor que el saldo",()=>{
  const r=consume(bucket({tokens:1,capacity:5}),0,3);
  expect(r.allowed).toBe(false);
  expect(r.bucket.tokens).toBeGreaterThanOrEqual(0);
 });
 it("tolera la imprecisión de coma flotante en recargas fraccionarias (no niega un token ya prometido)",()=>{
  // 0.8333 + 0.1667 puede dar 0.9999999: sin la tolerancia de 1e-9 se negaría el token que Retry-After anunció.
  const casi=bucket({tokens:0.8333,capacity:1,refillPerSecond:1,lastMs:0});
  expect(consume(casi,166.7).allowed).toBe(true);
 });
 it("un reloj que va hacia atrás no regala tokens",()=>{
  const gastado=consume(bucket({capacity:1,tokens:1,refillPerSecond:1,lastMs:10_000}),10_000).bucket;
  expect(consume(gastado,5_000).allowed).toBe(false);
 });
});
