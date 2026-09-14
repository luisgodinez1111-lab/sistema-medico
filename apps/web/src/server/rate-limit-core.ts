/**
 * Lógica pura de rate limiting por ventana fija (NIVEL 15, §25). Sin dependencias
 * de servidor: testeable. El wrapper (`rate-limit.ts`) la usa con un store en
 * memoria y, si hay Upstash configurado, con Redis distribuido.
 */

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * Ventana fija sobre un store en memoria (Map). Cuenta peticiones por `key` en
 * `windowMs`; bloquea al superar `limit`. Determinista con `now` inyectable.
 */
export function fixedWindowCheck(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateResult {
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - entry.count, retryAfterSec: 0 };
}

/** Descarta entradas expiradas (limpieza oportunista del store en memoria). */
export function pruneExpired(store: Map<string, WindowEntry>, now: number): void {
  for (const [k, e] of store) {
    if (now >= e.resetAt) store.delete(k);
  }
}
