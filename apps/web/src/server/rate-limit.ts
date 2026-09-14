import 'server-only';
import {
  fixedWindowCheck,
  pruneExpired,
  type RateResult,
  type WindowEntry,
} from './rate-limit-core';

/**
 * Rate limiting (NIVEL 15, §25). Best-effort en memoria por instancia; si hay
 * Upstash Redis configurado (`UPSTASH_REDIS_REST_URL` + `_TOKEN`), usa un contador
 * DISTRIBUIDO por REST (fetch, sin SDK) que sí es compartido entre instancias.
 *
 * Limitación honesta: sin Upstash, cada instancia serverless cuenta por separado
 * y el contador se reinicia en cold start — mitiga fuerza bruta ingenua pero no es
 * una defensa distribuida. Con Upstash, es robusto entre instancias.
 */

const store = new Map<string, WindowEntry>();

async function upstashFixedWindow(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateResult | null> {
  try {
    // Pipeline REST: INCR key ; EXPIRE key windowSec NX (solo fija TTL la 1ª vez).
    const res = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
      ]),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (!count) return null;
    if (count > limit) return { ok: false, remaining: 0, retryAfterSec: windowSec };
    return { ok: true, remaining: limit - count, retryAfterSec: 0 };
  } catch {
    return null;
  }
}

/**
 * Comprueba el límite para `key`. `limit` peticiones por `windowSec`. Nunca lanza:
 * ante fallo del backend, cae al store en memoria (fail-open controlado).
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<RateResult> {
  const fullKey = `rl:${key}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const r = await upstashFixedWindow(url, token, fullKey, opts.limit, opts.windowSec);
    if (r) return r;
    // Si Upstash falla, no bloqueamos por su culpa: caemos a memoria.
  }
  const now = Date.now();
  if (store.size > 5000) pruneExpired(store, now);
  return fixedWindowCheck(store, fullKey, opts.limit, opts.windowSec * 1000, now);
}
