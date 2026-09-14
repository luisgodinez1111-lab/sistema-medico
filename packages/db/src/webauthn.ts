import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

/**
 * WebAuthn / passkeys (§NIVEL 2/15). Módulo PURO: envuelve la verificación
 * criptográfica de @simplewebauthn (COSE/CBOR/attestation) — no se implementa a
 * mano por ser sensible. No toca la BD; el almacenamiento vive en
 * `webauthn-credentials.ts`. La llave PRIVADA nunca sale del dispositivo.
 */

export interface RpConfig {
  /** Relying Party ID: dominio (sufijo registrable del origen). */
  rpID: string;
  rpName: string;
  /** Origen exacto esperado en la ceremonia (https://host). */
  origin: string;
}

/**
 * Resuelve el Relying Party desde el host del request. WebAuthn exige que el
 * `rpID` sea sufijo registrable del origen, así que derivarlo del host hace que
 * funcione en cualquier alias (Vercel expone varios). `WEBAUTHN_RP_ID/_ORIGIN/
 * _NAME` lo sobreescriben si se definen.
 */
export function resolveRp(
  host: string,
  env: Record<string, string | undefined> = process.env,
): RpConfig {
  const hostNoPort = host.split(':')[0] ?? host;
  const rpID = env.WEBAUTHN_RP_ID || hostNoPort;
  const rpName = env.WEBAUTHN_RP_NAME || 'Medical OS';
  const scheme = hostNoPort === 'localhost' || hostNoPort === '127.0.0.1' ? 'http' : 'https';
  const origin = env.WEBAUTHN_RP_ORIGIN || `${scheme}://${host}`;
  return { rpID, rpName, origin };
}

function parseTransports(csv: string | null | undefined): string[] | undefined {
  if (!csv) return undefined;
  const list = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export interface CredentialSummary {
  credentialId: string; // base64url
  transports: string | null;
}

/** Opciones de REGISTRO (enrolamiento). `existing` evita re-registrar la misma llave. */
export function buildRegistrationOptions(params: {
  rp: RpConfig;
  userId: string;
  userName: string;
  userDisplayName: string;
  existing: CredentialSummary[];
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return generateRegistrationOptions({
    rpName: params.rp.rpName,
    rpID: params.rp.rpID,
    userName: params.userName,
    userDisplayName: params.userDisplayName,
    userID: new TextEncoder().encode(params.userId),
    attestationType: 'none',
    excludeCredentials: params.existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports) as never,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
}

export interface VerifiedRegistration {
  credentialId: string;
  publicKey: string; // base64url
  counter: number;
  transports: string | null;
  deviceType: string | null;
  backedUp: boolean;
}

/** Verifica la respuesta de registro; devuelve la credencial a persistir o null. */
export async function verifyRegistration(params: {
  rp: RpConfig;
  response: RegistrationResponseJSON;
  expectedChallenge: string;
}): Promise<VerifiedRegistration | null> {
  const verification = await verifyRegistrationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: params.rp.origin,
    expectedRPID: params.rp.rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) return null;
  const info = verification.registrationInfo;
  return {
    credentialId: info.credential.id,
    publicKey: isoBase64URL.fromBuffer(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports?.join(',') ?? null,
    deviceType: info.credentialDeviceType ?? null,
    backedUp: info.credentialBackedUp ?? false,
  };
}

/** Opciones de AUTENTICACIÓN. Sin `allow` = flujo sin usuario (passkey descubrible). */
export function buildAuthenticationOptions(params: {
  rp: RpConfig;
  allow?: CredentialSummary[];
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: params.rp.rpID,
    userVerification: 'preferred',
    ...(params.allow
      ? {
          allowCredentials: params.allow.map((c) => ({
            id: c.credentialId,
            transports: parseTransports(c.transports) as never,
          })),
        }
      : {}),
  });
}

export interface CredentialForAuth {
  credentialId: string;
  publicKey: string; // base64url
  counter: number;
  transports: string | null;
}

/** Verifica una aserción; devuelve verified + el nuevo contador anti-clonación. */
export async function verifyAuthentication(params: {
  rp: RpConfig;
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  credential: CredentialForAuth;
}): Promise<{ verified: boolean; newCounter: number }> {
  const verification = await verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: params.rp.origin,
    expectedRPID: params.rp.rpID,
    requireUserVerification: false,
    credential: {
      id: params.credential.credentialId,
      publicKey: isoBase64URL.toBuffer(params.credential.publicKey),
      counter: params.credential.counter,
      transports: parseTransports(params.credential.transports) as never,
    },
  });
  return {
    verified: verification.verified,
    newCounter: verification.authenticationInfo.newCounter,
  };
}

export type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
};
