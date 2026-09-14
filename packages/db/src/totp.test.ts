import { describe, it, expect } from 'vitest';
import { generateTotpSecret, generateTotp, verifyTotp, totpAuthUri } from './totp';

describe('TOTP (RFC 6238) — MFA', () => {
  it('genera un secreto Base32 válido', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(30);
  });

  it('verifica el código vigente y rechaza uno incorrecto', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = generateTotp(secret, now);
    expect(verifyTotp(secret, code, now)).toBe(true);
    expect(verifyTotp(secret, '000000', now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
    expect(verifyTotp(secret, code.slice(0, 5), now)).toBe(false);
  });

  it('tolera desfase de reloj de ±1 paso pero no más', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const codePrev = generateTotp(secret, now - 30_000); // paso anterior
    const codeNext = generateTotp(secret, now + 30_000); // paso siguiente
    expect(verifyTotp(secret, codePrev, now, 1)).toBe(true);
    expect(verifyTotp(secret, codeNext, now, 1)).toBe(true);
    // Fuera de la ventana (2 pasos) → rechazado.
    const codeFar = generateTotp(secret, now + 90_000);
    expect(verifyTotp(secret, codeFar, now, 1)).toBe(false);
  });

  it('el vector RFC 6238 (secreto ASCII "12345678901234567890") coincide', () => {
    // Secreto de prueba del RFC en Base32 = GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    // T=59s → contador 1 → código conocido 287082.
    expect(generateTotp(secret, 59_000)).toBe('287082');
  });

  it('totpAuthUri arma el otpauth con issuer y secreto', () => {
    const uri = totpAuthUri('ABCDEF', 'demo@medicalos.local');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=ABCDEF');
    expect(uri).toContain('issuer=Medical+OS');
  });
});
