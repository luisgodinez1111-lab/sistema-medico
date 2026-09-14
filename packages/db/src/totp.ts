import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) para MFA (NIVEL 2/15). HMAC-SHA1, 6 dígitos, ventana de 30 s —
 * compatible con Google Authenticator / Authy / 1Password. Implementado con
 * `node:crypto`, sin dependencias ni servicios externos.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SEC = 30;
const DIGITS = 6;

/** Genera un secreto aleatorio en Base32 (RFC 4648, sin padding). */
export function generateTotpSecret(byteLength = 20): string {
  const buf = randomBytes(byteLength);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of clean) bits += BASE32.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226) de un contador dado. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** Código TOTP vigente para un secreto en un instante (default: ahora). */
export function generateTotp(secretB32: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / STEP_SEC);
  return hotp(base32Decode(secretB32), counter);
}

/**
 * Verifica un token de 6 dígitos con tolerancia `window` pasos (default ±1, ~90 s
 * de margen por desfase de reloj). Comparación en tiempo constante.
 */
export function verifyTotp(
  secretB32: string,
  token: string,
  atMs: number = Date.now(),
  window = 1,
): boolean {
  const t = (token ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(t)) return false;
  const secret = base32Decode(secretB32);
  const counter = Math.floor(atMs / 1000 / STEP_SEC);
  const provided = Buffer.from(t);
  for (let w = -window; w <= window; w++) {
    const candidate = Buffer.from(hotp(secret, counter + w));
    if (candidate.length === provided.length && timingSafeEqual(candidate, provided)) return true;
  }
  return false;
}

/** URI `otpauth://` para el QR de enrolamiento en la app de autenticación. */
export function totpAuthUri(secretB32: string, account: string, issuer = 'Medical OS'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
