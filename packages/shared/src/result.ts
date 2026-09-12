/**
 * Result<T, E> — manejo de errores explícito.
 *
 * Regla del plan y de ~/.claude/CLAUDE.md: "Manejo de errores explícito — no
 * silencies errores con catch vacíos". En los límites del dominio devolvemos
 * Result en lugar de lanzar, para que el llamador esté obligado a manejar el
 * fallo. Las excepciones se reservan para errores verdaderamente inesperados.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/** Aplica `fn` al valor si es Ok; propaga el error si es Err. */
export function map<T, U, E>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

/** Encadena operaciones que devuelven Result. */
export function flatMap<T, U, E>(r: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return r.ok ? fn(r.value) : r;
}

/** Extrae el valor o lanza. Usar solo cuando un Err es un bug de programación. */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap() sobre Err: ${JSON.stringify(r.error)}`);
}

/** Extrae el valor o devuelve un valor por defecto. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}
