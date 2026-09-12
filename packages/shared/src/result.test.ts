import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, map, flatMap, unwrapOr } from './result.js';

describe('Result', () => {
  it('ok/err discriminan correctamente', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('x'))).toBe(true);
  });

  it('map transforma Ok y propaga Err', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    expect(map(err<string>('e'), (n: number) => n * 3)).toEqual(err('e'));
  });

  it('flatMap encadena', () => {
    const parse = (s: string) => (Number.isNaN(Number(s)) ? err('NaN') : ok(Number(s)));
    expect(flatMap(ok('4'), parse)).toEqual(ok(4));
    expect(flatMap(ok('z'), parse)).toEqual(err('NaN'));
  });

  it('unwrapOr devuelve fallback en Err', () => {
    expect(unwrapOr(err('e'), 99)).toBe(99);
  });
});
