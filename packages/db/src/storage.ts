import { createHash, createHmac } from 'node:crypto';
import {
  err,
  ok,
  ValidationError,
  PreconditionFailedError,
  type Result,
  type DomainError,
} from '@medical-os/shared';

/**
 * Object storage privado para documentos clínicos (Release R5).
 *
 * La BD guarda SOLO metadata + hash + clave; los bytes viven aquí (ADR-0003 §10,
 * §33 #5). El acceso se hace con URLs prefirmadas de corta duración: el cliente
 * sube con un PUT prefirmado y descarga con un GET prefirmado a través de un
 * proxy autorizado. Nunca se exponen URLs públicas ni credenciales al cliente.
 *
 * La firma es AWS SigV4 (compatible con S3, Cloudflare R2, Backblaze B2, MinIO),
 * implementada con `node:crypto` — sin SDK ni dependencias externas. Si no hay
 * credenciales configuradas, el proveedor queda `unconfigured` y devuelve un
 * error de precondición claro (nunca una URL falsa).
 */

export interface PresignedTarget {
  /** URL prefirmada absoluta (uso único, expira). */
  url: string;
  /** Método HTTP con el que debe usarse la URL. */
  method: 'PUT' | 'GET';
  /** Clave (key) del objeto dentro del bucket. */
  key: string;
  /** Segundos hasta la expiración de la URL. */
  expiresInSeconds: number;
  /** Cabeceras que el cliente DEBE enviar tal cual (para que la firma valide). */
  headers: Record<string, string>;
}

export interface StorageProvider {
  /** Nombre del proveedor (queda en `storage_provider`). */
  readonly provider: string;
  /** true si hay credenciales y las operaciones funcionarán. */
  readonly configured: boolean;
  /** URL prefirmada para subir un objeto (PUT). */
  presignUpload(key: string, contentType: string): Result<PresignedTarget, DomainError>;
  /** URL prefirmada para descargar un objeto (GET). */
  presignDownload(key: string): Result<PresignedTarget, DomainError>;
}

const DEFAULT_EXPIRY = 300; // 5 min: ventana corta (§33 #5)

/** Proveedor nulo: no hay bucket configurado. Nunca inventa URLs. */
export class NullStorageProvider implements StorageProvider {
  readonly provider = 'unconfigured';
  readonly configured = false;

  private disabled(): Result<PresignedTarget, DomainError> {
    return err(new PreconditionFailedError('Almacenamiento de documentos no configurado.'));
  }
  presignUpload(): Result<PresignedTarget, DomainError> {
    return this.disabled();
  }
  presignDownload(): Result<PresignedTarget, DomainError> {
    return this.disabled();
  }
}

export interface S3StorageConfig {
  endpoint: string; // p.ej. https://<accountid>.r2.cloudflarestorage.com
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Segundos de expiración de las URLs prefirmadas (default 300). */
  expiresInSeconds?: number;
  /** Reloj inyectable para pruebas deterministas. */
  now?: () => Date;
}

const sha256Hex = (data: string): string => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data, 'utf8').digest();

/** Codifica un segmento de path según las reglas de S3 (RFC 3986, sin codificar '/'). */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(
        /[!'()*]/g,
        (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
      ),
    )
    .join('/');
}

function amzDate(d: Date): { date: string; dateTime: string } {
  const iso = d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return { dateTime: iso, date: iso.slice(0, 8) };
}

/**
 * Proveedor S3-compatible con URLs prefirmadas (AWS SigV4, query-string).
 * No sube ni descarga bytes desde el servidor: solo firma URLs que el cliente
 * autorizado usa directamente contra el bucket privado.
 */
export class S3StorageProvider implements StorageProvider {
  readonly provider: string;
  readonly configured = true;
  private readonly cfg: Required<Omit<S3StorageConfig, 'now'>> & { now: () => Date };

  constructor(config: S3StorageConfig) {
    this.cfg = {
      endpoint: config.endpoint.replace(/\/+$/, ''),
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      expiresInSeconds: config.expiresInSeconds ?? DEFAULT_EXPIRY,
      now: config.now ?? (() => new Date()),
    };
    this.provider = `s3:${this.cfg.bucket}`;
  }

  private presign(method: 'PUT' | 'GET', key: string): Result<PresignedTarget, DomainError> {
    if (!key || key.includes('..') || key.startsWith('/')) {
      return err(new ValidationError('Clave de objeto inválida.'));
    }
    const { dateTime, date } = amzDate(this.cfg.now());
    const host = new URL(this.cfg.endpoint).host;
    const credentialScope = `${date}/${this.cfg.region}/s3/aws4_request`;
    const encodedKey = encodeKey(key);
    const canonicalUri = `/${this.cfg.bucket}/${encodedKey}`;

    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.cfg.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': dateTime,
      'X-Amz-Expires': String(this.cfg.expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k]!)}`)
      .join('&');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateTime,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.cfg.secretAccessKey}`, date), this.cfg.region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const url = `${this.cfg.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
    return ok({
      url,
      method,
      key,
      expiresInSeconds: this.cfg.expiresInSeconds,
      headers: {},
    });
  }

  presignUpload(key: string, _contentType: string): Result<PresignedTarget, DomainError> {
    return this.presign('PUT', key);
  }
  presignDownload(key: string): Result<PresignedTarget, DomainError> {
    return this.presign('GET', key);
  }
}

/** Variables de entorno que configuran el bucket S3-compatible. */
export interface StorageEnv {
  STORAGE_S3_ENDPOINT?: string | undefined;
  STORAGE_S3_REGION?: string | undefined;
  STORAGE_S3_BUCKET?: string | undefined;
  STORAGE_S3_ACCESS_KEY_ID?: string | undefined;
  STORAGE_S3_SECRET_ACCESS_KEY?: string | undefined;
}

/**
 * Resuelve el proveedor de storage desde el entorno. Si faltan credenciales,
 * devuelve el proveedor nulo (`unconfigured`) — el flujo de documentos sigue
 * registrando metadata, pero no permite subir bytes hasta configurar el bucket.
 */
export function resolveStorageProvider(
  env: StorageEnv | Record<string, string | undefined>,
): StorageProvider {
  const { STORAGE_S3_ENDPOINT, STORAGE_S3_REGION, STORAGE_S3_BUCKET } = env;
  const key = env.STORAGE_S3_ACCESS_KEY_ID;
  const secret = env.STORAGE_S3_SECRET_ACCESS_KEY;
  if (STORAGE_S3_ENDPOINT && STORAGE_S3_REGION && STORAGE_S3_BUCKET && key && secret) {
    return new S3StorageProvider({
      endpoint: STORAGE_S3_ENDPOINT,
      region: STORAGE_S3_REGION,
      bucket: STORAGE_S3_BUCKET,
      accessKeyId: key,
      secretAccessKey: secret,
    });
  }
  return new NullStorageProvider();
}

/**
 * Construye la clave de storage de un documento. Namespacing por tenant/paciente
 * para aislamiento y trazabilidad; el id del documento es único (ULID).
 */
export function documentStorageKey(
  tenantId: string,
  patientId: string,
  documentId: string,
): string {
  return `tenants/${tenantId}/patients/${patientId}/documents/${documentId}`;
}
