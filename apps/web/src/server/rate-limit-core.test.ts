import { describe, it, expect } from 'vitest';
import { fixedWindowCheck, pruneExpired, type WindowEntry } from './rate-limit-core';

describe('fixedWindowCheck (NIVEL 15)', () => {
  it('permite hasta el límite y luego bloquea dentro de la ventana', () => {
    const store = new Map<string, WindowEntry>();
    const key = 'login:1.2.3.4';
    const t0 = 1_000_000;
    // limit 3, ventana 60s.
    expect(fixedWindowCheck(store, key, 3, 60_000, t0).ok).toBe(true); // 1
    expect(fixedWindowCheck(store, key, 3, 60_000, t0 + 1).ok).toBe(true); // 2
    const third = fixedWindowCheck(store, key, 3, 60_000, t0 + 2);
    expect(third.ok).toBe(true); // 3
    expect(third.remaining).toBe(0);
    const blocked = fixedWindowCheck(store, key, 3, 60_000, t0 + 3); // 4 → bloqueo
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('reinicia la cuenta al expirar la ventana', () => {
    const store = new Map<string, WindowEntry>();
    const key = 'k';
    const t0 = 0;
    fixedWindowCheck(store, key, 1, 1000, t0); // 1 (ok)
    expect(fixedWindowCheck(store, key, 1, 1000, t0 + 500).ok).toBe(false); // bloqueado
    // Pasada la ventana → nuevo periodo.
    expect(fixedWindowCheck(store, key, 1, 1000, t0 + 1000).ok).toBe(true);
  });

  it('aísla por clave (distintas IPs no se afectan)', () => {
    const store = new Map<string, WindowEntry>();
    fixedWindowCheck(store, 'a', 1, 1000, 0);
    expect(fixedWindowCheck(store, 'a', 1, 1000, 1).ok).toBe(false);
    expect(fixedWindowCheck(store, 'b', 1, 1000, 1).ok).toBe(true);
  });

  it('pruneExpired limpia entradas vencidas', () => {
    const store = new Map<string, WindowEntry>();
    fixedWindowCheck(store, 'x', 5, 1000, 0);
    pruneExpired(store, 2000);
    expect(store.has('x')).toBe(false);
    expect(store.size).toBe(0);
  });
});
