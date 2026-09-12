/**
 * Jerarquía de errores del dominio. Cada error lleva un `code` estable para
 * telemetría (§17) y un flag de si es seguro exponer el mensaje al cliente.
 * Nunca se incluye PHI en `message` (§NIVEL 10, §33).
 */

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'CROSS_TENANT'
  | 'PRECONDITION_FAILED'
  | 'INTERNAL';

export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  /** Si el mensaje puede mostrarse al usuario final sin filtrar detalles internos. */
  readonly clientSafe: boolean = true;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION' as const;
  constructor(
    message: string,
    readonly issues?: ReadonlyArray<{ path: string; message: string }>,
  ) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND' as const;
}

export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED' as const;
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN' as const;
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT' as const;
}

/**
 * Intento de acceso a datos de otro tenant. Es un evento de seguridad crítico
 * (§NIVEL 2, §25): se registra en auditoría y nunca revela detalles al cliente.
 */
export class CrossTenantError extends DomainError {
  readonly code = 'CROSS_TENANT' as const;
  override readonly clientSafe = false;
}

export class PreconditionFailedError extends DomainError {
  readonly code = 'PRECONDITION_FAILED' as const;
}

export class InternalError extends DomainError {
  readonly code = 'INTERNAL' as const;
  override readonly clientSafe = false;
}
