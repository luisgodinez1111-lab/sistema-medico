import { describe, it, expect } from 'vitest';
import {
  NullStorageProvider,
  S3StorageProvider,
  resolveStorageProvider,
  documentStorageKey,
  type S3StorageConfig,
} from './storage';

const fixedNow = () => new Date('2026-09-13T12:00:00.000Z');

const cfg: S3StorageConfig = {
  endpoint: 'https://accountid.r2.cloudflarestorage.com',
  region: 'auto',
  bucket: 'clinical-docs',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secretexamplekey',
  expiresInSeconds: 300,
  now: fixedNow,
};

describe('NullStorageProvider', () => {
  it('no está configurado y falla con precondición (no inventa URLs)', () => {
    const p = new NullStorageProvider();
    expect(p.configured).toBe(false);
    expect(p.provider).toBe('unconfigured');
    const up = p.presignUpload('k', 'application/pdf');
    expect(up.ok).toBe(false);
    if (!up.ok) expect(up.error.code).toBe('PRECONDITION_FAILED');
    expect(p.presignDownload('k').ok).toBe(false);
  });
});

describe('S3StorageProvider (SigV4 presign)', () => {
  const p = new S3StorageProvider(cfg);

  it('firma un PUT prefirmado con los parámetros esperados', () => {
    const r = p.presignUpload('tenants/t1/patients/p1/documents/d1', 'application/pdf');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const url = new URL(r.value.url);
    expect(url.host).toBe('accountid.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/clinical-docs/tenants/t1/patients/p1/documents/d1');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'AKIAEXAMPLE/20260913/auto/s3/aws4_request',
    );
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(r.value.method).toBe('PUT');
  });

  it('la firma es determinista (mismo input → misma firma)', () => {
    const a = p.presignUpload('k/1', 'application/pdf');
    const b = p.presignUpload('k/1', 'application/pdf');
    expect(a.ok && b.ok && a.value.url === b.value.url).toBe(true);
  });

  it('cambia la firma si cambia la clave', () => {
    const a = p.presignDownload('k/1');
    const b = p.presignDownload('k/2');
    expect(a.ok && b.ok && a.value.url !== b.value.url).toBe(true);
  });

  it('rechaza claves con path traversal', () => {
    const r = p.presignUpload('../../etc/passwd', 'text/plain');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('VALIDATION');
  });

  it('codifica caracteres especiales sin romper el separador de path', () => {
    const r = p.presignDownload('a b/c+d');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.url).toContain('/a%20b/c%2Bd');
  });
});

describe('resolveStorageProvider', () => {
  it('devuelve el proveedor nulo cuando faltan credenciales', () => {
    expect(resolveStorageProvider({}).configured).toBe(false);
    expect(
      resolveStorageProvider({ STORAGE_S3_ENDPOINT: 'x', STORAGE_S3_BUCKET: 'b' }).configured,
    ).toBe(false);
  });

  it('devuelve el proveedor S3 cuando están todas las credenciales', () => {
    const p = resolveStorageProvider({
      STORAGE_S3_ENDPOINT: cfg.endpoint,
      STORAGE_S3_REGION: cfg.region,
      STORAGE_S3_BUCKET: cfg.bucket,
      STORAGE_S3_ACCESS_KEY_ID: cfg.accessKeyId,
      STORAGE_S3_SECRET_ACCESS_KEY: cfg.secretAccessKey,
    });
    expect(p.configured).toBe(true);
    expect(p.provider).toBe('s3:clinical-docs');
  });
});

describe('documentStorageKey', () => {
  it('namespacea por tenant/paciente/documento', () => {
    expect(documentStorageKey('t1', 'p1', 'd1')).toBe('tenants/t1/patients/p1/documents/d1');
  });
});
